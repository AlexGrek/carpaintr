.PHONY: docker-build docker-push all deploy-service redeploy dev frontend backend docker-build-pdfgen docker-build-backend deploy-pdfgen

NAME?=autolab-api
PDFGEN_NAME?=autolab-pdfgen
IMAGE_NAME?=localhost:5000/$(NAME)
PDFGEN_IMAGE_NAME?=localhost:5000/$(PDFGEN_NAME)
NAMESPACE?=autolab

docker-build: docker-build-backend docker-build-pdfgen

docker-build-pdfgen:
	cd pdf_backend
	docker build . -t $(PDFGEN_IMAGE_NAME)

docker-build-backend:
	docker build . -t $(IMAGE_NAME)

docker-push:
	docker push $(IMAGE_NAME)

all: docker-build docker-push

redeploy: all
	kubectl delete pod -n $(NAMESPACE) -l app=autolab-api
	kubectl delete pod -n $(NAMESPACE) -l app=autolab-pdfgen

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

deploy-pdfgen:
	kubectl --namespace $(NAMESPACE) apply -f k8s-deploy/pdfgen-k3s-deployment.yaml

deploy-service: deploy-pdfgen
	kubectl --namespace $(NAMESPACE) apply -f k8s-deploy/secret.yaml
	kubectl --namespace $(NAMESPACE) apply -f k8s-deploy/k3s-deployment.yaml
	kubectl --namespace $(NAMESPACE) apply -f k8s-deploy/traefik-ingressroute.yaml

# dev targets

dev:
	@bash -c '\
		if [ ! -d carpaintr-front/node_modules ]; then \
			echo "Installing frontend dependencies..."; \
			cd carpaintr-front && npm install || exit $$?; \
			cd ..; \
		fi; \
		echo "Starting frontend and backend..."; \
		trap "echo Killing...; kill 0" SIGINT; \
		(cd carpaintr-front && npm run dev) & \
		(cd backend-service-rust && cargo watch -x run) & \
		wait'
