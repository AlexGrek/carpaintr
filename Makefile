.PHONY: docker-build docker-push all

NAME?=autolab-api
IMAGE_NAME?=localhost:5000/$(NAME)

docker-build:
	docker build . -t $(IMAGE_NAME)

docker-push:
	docker push $(IMAGE_NAME)

all: docker-build docker-push

# secret.yaml:
# apiVersion: v1
# kind: Secret
# metadata:
#   name: autolab-api-secret
# type: Opaque
# data:
#   SECRET_KEY: c29tZXNlcmNyZXQ=  # base64 encoded string of 'somesercret'
#   SECRET_KEY_LICENSE: c29tZXRoaW5nIHN0dXBpZA==  # base64 encoded string of 'something stupid'

deploy-service:
	kubectl apply -f secret.yaml
# kubectl apply -f pvc-pv.yaml
	kubectl apply -f k3s-deployment.yaml
	kubectl apply -f traefik-ingressroute.yaml