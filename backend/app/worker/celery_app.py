from celery import Celery

from app.core.config import get_settings

celery_app = Celery("noolagam", broker=get_settings().redis_url, include=["app.worker.tasks"])
celery_app.conf.update(
    broker_connection_retry_on_startup=True,
    broker_transport_options={"socket_connect_timeout": 2, "socket_timeout": 5},
    task_ignore_result=True,
    timezone="UTC",
)
