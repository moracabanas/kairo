# ClearML Agent Setup

This directory contains the ClearML agent configuration for model training.

## Quick Start

### Using Docker

```bash
# Build the agent image
docker build -t clearml-training-agent services/clearml/

# Run the agent
docker run -d \
  -e CLEARML_API_HOST=http://localhost:8080 \
  -e CLEARML_WEB_HOST=http://localhost:8080 \
  -e CLEARML_FILES_HOST=http://localhost:8081 \
  -e CLEARML_API_ACCESS_KEY=your_access_key \
  -e CLEARML_API_SECRET_KEY=your_secret_key \
  clearml-training-agent
```

### Using Python Virtual Environment

```bash
pip install clearml

export CLEARML_API_HOST=http://localhost:8080
export CLEARML_WEB_HOST=http://localhost:8080
export CLEARML_FILES_HOST=http://localhost:8081
export CLEARML_API_ACCESS_KEY=your_access_key
export CLEARML_API_SECRET_KEY=your_secret_key

clearml-agent daemon --queue training
```

## Queue System

ClearML uses a queue-based system for task distribution:

- **Queues** hold training tasks that agents pick up
- Each agent subscribes to one or more queues
- Tasks are processed in FIFO order within each queue
- Default queue name: `training`

### Managing Queues

```bash
# Create a new queue
clearml-agent daemon --queue training --create-queue

# List available queues
clearml queue list

# View queue contents
clearml queue get training
```

## Submitting Training Tasks

### From Python Code

```python
from clearml import Task

task = Task.init(
    project_name='my-project',
    task_name='training-run',
    task_type=Task.TaskTypes.TRAINING
)

# Your training code here
trainer = MyTrainer()
trainer.fit()

task.close()
```

### From Command Line

```bash
clearml-run my_training_script.py --queue training
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLEARML_API_HOST` | ClearML API server URL | `http://localhost:8080` |
| `CLEARML_WEB_HOST` | ClearML web UI URL | `http://localhost:8080` |
| `CLEARML_FILES_HOST` | ClearML files server URL | `http://localhost:8081` |
| `CLEARML_API_ACCESS_KEY` | API access key | - |
| `CLEARML_API_SECRET_KEY` | API secret key | - |

## Agent Modes

The agent supports two modes:

1. **Python mode** (`mode: python`): Executes tasks in the current Python environment
2. **Docker mode** (`mode: docker`): Spawns each task in a separate Docker container

Use Docker mode for better isolation and reproducibility.
