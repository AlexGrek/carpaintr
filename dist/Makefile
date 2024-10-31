IMAGE_NAME ?= knktools-srv
CONTAINER_NAME ?= knktools
PORT ?= 6069

.PHONY: docker-build
docker-build:
	chmod +x ./server
	docker build -t $(IMAGE_NAME) .

.PHONY: docker-run
docker-run:
	mkdir -p $(shell pwd)/secrets
	docker run -d -u $(shell id -u):$(shell id -g) -e USER=$(shell id -un) -v $(shell pwd)/secrets:/secrets -v $(shell pwd)/demotexts:/data -p $(PORT):6969 --name "$(CONTAINER_NAME)" $(IMAGE_NAME)

.PHONY: docker-run-debug
docker-run-debug:
	docker run -it --rm -u $(id -u):$(id -g) -v $(shell pwd)/secrets:/secrets -v $(shell pwd)/demotexts:/data -p $(PORT):6969 --name "$(CONTAINER_NAME)" --entrypoint /bin/sh $(IMAGE_NAME)

.PHONY: docker-kill
docker-kill:
	docker rm -f "$(CONTAINER_NAME)"

.PHONY: re-docker
re-docker: docker-kill docker-build docker-run
	sleep 3s && docker logs $(CONTAINER_NAME)

unpack:
	unzip -o release.zip

clean:
	@rm -vrf Dockerfile server server.exe static
	
update: clean unpack re-docker


.PHONY: unpack update clean