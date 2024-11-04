import sys
import json
import tempfile
import requests
import numpy as np
from urllib.parse import urlparse
from pathlib import Path
import base64

# Add these environment variables before cv2 import
import os
os.environ["OPENCV_DISABLE_EXTENDED_LOADER"] = "1"
# Disable GStreamer to prevent the circular import issue
os.environ["OPENCV_VIDEOIO_PRIORITY_GSTREAMER"] = "0"

# Import cv2 with error handling
import cv2

def download_video(url: str) -> str:
    """Download video to a temporary file and return the path"""
    try:
        # Create a temporary file with .mp4 extension
        temp_file = tempfile.NamedTemporaryFile(suffix='.mp4', delete=False)
        
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # Write the video data to the temporary file
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
        # If it's a URL, download it first
        if urlparse(video_url).scheme in ['http', 'https']:
            temp_file = download_video(video_url)
            video_path = temp_file
        else:
            video_path = video_url

        # Initialize video capture
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise Exception(f"Could not open video file: {video_path}")

        # Get basic video info
        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            fps = 30  # Default to 30fps if can't detect

        # Get frame count and duration
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0

        if duration <= 0:
            # Manually count frames if duration detection fails
            frame_count = 0
            while cap.grab():
                frame_count += 1
            duration = frame_count / fps
            # Reset video to start
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

        frames = []
        frame_interval = 10  # Extract frame every 10 seconds
        current_sec = 0

        while current_sec < duration:
            # Set position in video (convert seconds to frames)
            frame_pos = int(current_sec * fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_pos)
            
            ret, frame = cap.read()
            if ret:
                try:
                    # Convert frame to JPEG
                    _, buffer = cv2.imencode('.jpg', frame)
                    # Convert to base64
                    base64_frame = base64.b64encode(buffer).decode('utf-8')
                    frames.append({
                        'timestamp': current_sec,
                        'data': f'data:image/jpeg;base64,{base64_frame}'
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
        # Clean up resources
        if cap is not None:
            cap.release()
        if temp_file and Path(temp_file).exists():
            try:
                Path(temp_file).unlink()
            except:
                pass  # Ignore cleanup errors

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