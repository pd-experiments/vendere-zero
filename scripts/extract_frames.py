import sys
import json
import tempfile
import requests
import numpy as np
from urllib.parse import urlparse
from pathlib import Path
import base64
from io import BytesIO
from PIL import Image

# Add these environment variables before cv2 import
import os
os.environ["OPENCV_DISABLE_EXTENDED_LOADER"] = "1"
os.environ["OPENCV_VIDEOIO_PRIORITY_GSTREAMER"] = "0"

import cv2

def compress_image_base64(image_array, quality=85, max_size=(1920, 1080)):
    """Compress image and convert to base64"""
    # Convert CV2 image to PIL
    image = Image.fromarray(cv2.cvtColor(image_array, cv2.COLOR_BGR2RGB))
    
    # Resize if larger than max_size while maintaining aspect ratio
    if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
    
    # Save to buffer with compression
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=quality, optimize=True)
    
    # Convert to base64
    base64_image = base64.b64encode(buffer.getvalue()).decode('utf-8')
    return f'data:image/jpeg;base64,{base64_image}'

def download_video(url: str) -> str:
    """Download video to a temporary file and return the path"""
    try:
        temp_file = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
        
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        with open(temp_file.name, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        
        return temp_file.name
    except Exception as e:
        raise Exception(f"Failed to download video: {str(e)}")

def extract_frames(video_url: str) -> dict:
    temp_file = None
    cap = None
    try:
        # Download if URL
        if urlparse(video_url).scheme in ['http', 'https']:
            temp_file = download_video(video_url)
            video_path = temp_file
        else:
            video_path = video_url

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise Exception(f"Could not open video file: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            fps = 30

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0

        if duration <= 0:
            frame_count = 0
            while cap.grab():
                frame_count += 1
            duration = frame_count / fps
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

        frames = []
        frame_interval = 5  # Extract frame every 5 seconds for more detailed analysis
        current_sec = 0

        while current_sec < duration:
            frame_pos = int(current_sec * fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_pos)
            
            ret, frame = cap.read()
            if ret:
                try:
                    # Compress and convert frame to base64
                    base64_frame = compress_image_base64(frame)
                    frames.append({
                        'timestamp': current_sec,
                        'data': base64_frame
                    })
                except Exception as e:
                    print(f"Warning: Failed to process frame at {current_sec}s: {str(e)}", file=sys.stderr)
            
            current_sec += frame_interval

        return {
            'success': True,
            'frames': frames,
            'total_duration': duration,
            'frame_count': len(frames)
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }
    finally:
        if cap is not None:
            cap.release()
        if temp_file and Path(temp_file).exists():
            try:
                Path(temp_file).unlink()
            except:
                pass

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({'success': False, 'error': 'Video URL required'}))
        sys.exit(1)
    
    try:
        video_url = sys.argv[1]
        result = extract_frames(video_url)
        print(json.dumps(result))
        sys.exit(0 if result['success'] else 1)
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1) 