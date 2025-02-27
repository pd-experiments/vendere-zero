#!/bin/bash

# Set environment variables for Python module imports
export PYTHONPATH=$PYTHONPATH:$(pwd)

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
fi

# Run the API server
echo "Starting Knowledge API server..."
cd scripts/knowledge
python -m api_server

# Deactivate virtual environment if it was activated
if [ -n "$VIRTUAL_ENV" ]; then
    echo "Deactivating virtual environment..."
    deactivate
fi
