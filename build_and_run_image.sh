#!/usr/bin/env bash

set -euo pipefail

SCRIPTS_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
REPO_ROOT="$(cd "${SCRIPTS_DIR}" && pwd)"

DOCKER_IMAGE_NAME=my-supbase-sample
DOCKER_IMAGE_PATH=rkluszczynski/${DOCKER_IMAGE_NAME}
DOCKER_IMAGE_TAG=dev

docker stop "${DOCKER_IMAGE_NAME}" 2>/dev/null || true
docker rm --force "${DOCKER_IMAGE_NAME}" 2>/dev/null || true

docker build -f "${REPO_ROOT}/Dockerfile" -t "${DOCKER_IMAGE_PATH}:${DOCKER_IMAGE_TAG}" "${REPO_ROOT}"
docker push "${DOCKER_IMAGE_PATH}:${DOCKER_IMAGE_TAG}"

# docker run -p 4173:4173 --name "${DOCKER_IMAGE_NAME}" "${DOCKER_IMAGE_PATH}:${DOCKER_IMAGE_TAG}"
