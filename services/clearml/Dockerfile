FROM python:3.11

RUN pip install clearml

WORKDIR /opt/clearml_agent_working_dir

# Install additional ML dependencies
RUN pip install numpy pandas scikit-learn

CMD ["clearml-agent", "daemon", "--queue", "training"]
