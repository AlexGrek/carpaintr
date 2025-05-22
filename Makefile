.PHONY: docker-build docker-push all deploy-service redeploy dev frontend backend

NAME?=autolab-api
IMAGE_NAME?=localhost:5000/$(NAME)
NAMESPACE?=autolab

docker-build:
	docker build . -t $(IMAGE_NAME)

docker-push:
	docker push $(IMAGE_NAME)

all: docker-build docker-push

redeploy: all
	kubectl delete pod -n $(NAMESPACE) -l app=autolab-api

# secret.yaml:
# apiVersion: v1
# kind: Secret
# metadata:
#   name: autolab-api-secret
# type: Opaque
# data:
#   SECRET_KEY: c29tZXNlcmNyZXQ=  # base64 encoded string of 'somesercret'
#   SECRET_KEY_LICENSE: c29tZXRoaW5nIHN0dXBpZA==  # base64 encoded string of 'something stupid'
#   admins.txt: base64-encoded file

deploy-service:
	 kubectl --namespace $(NAMESPACE) apply -f k8s-deploy/secret.yaml
# kubectl apply -f pvc-pv.yaml
	kubectl --namespace $(NAMESPACE) apply -f k8s-deploy/k3s-deployment.yaml
	kubectl --namespace $(NAMESPACE) apply -f k8s-deploy/traefik-ingressroute.yaml

# dev targets

dev:
	@$(MAKE) frontend &
	@$(MAKE) backend &
	wait

frontend:
	cd carpaintr-front && npm run dev

backend:
	cd backend-service-rust && cargo watch -x run