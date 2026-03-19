## This is a self-documented Makefile. For usage information, run `make help`:
##
## For more information, refer to https://www.thapaliya.com/en/writings/well-documented-makefiles/

LDFLAGS += -X github.com/getfider/fider/app/pkg/env.commithash=${COMMITHASH}
LDFLAGS += -X github.com/getfider/fider/app/pkg/env.version=${VERSION}
DOCKER_COMPOSE ?= docker compose



##@ Running

run: ## Run Fider
	godotenv -f .env ./fider

migrate: dev-up wait-pgdev ## Run all database migrations
	godotenv -f .env ./fider migrate



##@ Building

build: build-server build-ssr build-ui ## Build server and ui

build-server: ## Build server
	go build -ldflags '-s -w $(LDFLAGS)' -o fider .

build-ui: ## Build all UI assets
	NODE_ENV=production npx webpack-cli

build-ssr: ## Build SSR script and locales
	npx lingui extract public/
	npx lingui compile
	NODE_ENV=production node esbuild.config.js



##@ Localization

locale-extract: ## Extract and overwrite English locale from source code
	npx lingui extract --overwrite

locale-reset: ## Reset translation for specific keys in all non-English locales (use KEY="key.name" or KEYS="key1 key2 ...")
	@if [ -z "$(KEY)$(KEYS)" ]; then \
		echo "Error: KEY or KEYS variable is required."; \
		echo "Usage: make locale-reset KEY=\"some.key\""; \
		echo "   or: make locale-reset KEYS=\"key1 key2 key3\""; \
		exit 1; \
	fi
	@keys="$(KEY) $(KEYS)"; \
	echo "Resetting translations for: $$keys"; \
	for lang in ar cs de el es-ES fa fr it ja ko nl pl pt-BR ru si-LK sk sv-SE tr zh-CN; do \
		echo "  Updating $$lang..."; \
		temp_file=$$(mktemp); \
		jq_expr=""; \
		for key in $$keys; do \
			if [ -n "$$key" ]; then \
				if [ -z "$$jq_expr" ]; then \
					jq_expr=".[\""$$key"\"] = \"\""; \
				else \
					jq_expr="$$jq_expr | .[\""$$key"\"] = \"\""; \
				fi; \
			fi; \
		done; \
		jq "$$jq_expr" locale/$$lang/client.json > $$temp_file && \
		mv $$temp_file locale/$$lang/client.json; \
	done
	@echo "Done!"



##@ Testing

test: test-server test-ui ## Test server and ui code

test-server: build-server build-ssr ## Run all server tests (set SHORT=false for full tests including network-dependent tests)
	godotenv -f .test.env ./fider migrate
	godotenv -f .test.env go test ./... -race $(if $(filter false,$(SHORT)),,-short)

test-ui: ## Run all UI tests
	TZ=GMT npx jest ./public

coverage-server: build-server build-ssr ## Run all server tests (with code coverage, set SHORT=false for full tests)
	godotenv -f .test.env ./fider migrate
	godotenv -f .test.env go test ./... -coverprofile=cover.out -coverpkg=all -p=8 -race $(if $(filter false,$(SHORT)),,-short)



##@ E2E Testing

test-e2e-server: ## Run all E2E tests
	npx cucumber-js e2e/features/server/**/*.feature --require-module ts-node/register --require 'e2e/**/*.ts' --publish-quiet

test-e2e-ui: ## Run all E2E tests
	npx cucumber-js e2e/features/ui/**/*.feature --require-module ts-node/register --require 'e2e/**/*.ts' --publish-quiet

test-e2e-ui-headed: ## Run all E2E tests with visible browser
	HEADED=true npx cucumber-js e2e/features/ui/**/*.feature --require-module ts-node/register --require 'e2e/**/*.ts' --publish-quiet

test-e2e-ui-scenario: ## Run specific E2E test scenario (use NAME="scenario name")
	npx cucumber-js e2e/features/ui/**/*.feature --require-module ts-node/register --require 'e2e/**/*.ts' --publish-quiet --name "$(NAME)"

test-e2e-ui-scenario-headed: ## Run specific E2E test scenario with visible browser (use NAME="scenario name")
	HEADED=true npx cucumber-js e2e/features/ui/**/*.feature --require-module ts-node/register --require 'e2e/**/*.ts' --publish-quiet --name "$(NAME)"
demo-preflight: ## Check that the local app is reachable for the Sentry demo
	@curl -fsS http://localhost:3000/ >/dev/null || (echo "Local app is not reachable at http://localhost:3000. Start it with 'make watch' first." && exit 1)

demo-trigger-sentry: demo-preflight ## Trigger the demo frontend crash that should report to Sentry
	E2E_HOST_MODE=single E2E_BASE_URL=http://localhost:3000 E2E_LOGIN_BASE_URL=http://localhost:3000 npx cucumber-js e2e/features/ui/sentry_demo.feature --require-module ts-node/register --require 'e2e/**/*.ts' --publish-quiet

demo-trigger-sentry-headed: demo-preflight ## Trigger the demo frontend crash with a visible browser
	HEADED=true E2E_HOST_MODE=single E2E_BASE_URL=http://localhost:3000 E2E_LOGIN_BASE_URL=http://localhost:3000 npx cucumber-js e2e/features/ui/sentry_demo.feature --require-module ts-node/register --require 'e2e/**/*.ts' --publish-quiet



##@ Running (Watch Mode)
watch: dev-down clean dev-up wait-pgdev build-ssr build-ui
watch:
	make -j4 watch-server watch-ui

watch-server: migrate ## Build and run server in watch mode
	air -c air.conf

watch-ui: ## Build and run server in watch mode
	npx webpack-cli -w



##@ Linting

lint: lint-server lint-ui ## Lint server and ui

lint-server: ## Lint server code
	golangci-lint run --timeout 3m

lint-ui: ## Lint ui code
	npx eslint .



##@ Miscellaneous

dev-up: ## Start local development dependencies
	$(DOCKER_COMPOSE) up -d pgdev smtp

wait-pgdev: ## Wait until the local development postgres is ready
	@until $(DOCKER_COMPOSE) exec -T pgdev pg_isready -U fider >/dev/null 2>&1; do \
		echo "Waiting for pgdev to be ready..."; \
		sleep 1; \
	done

dev-down: ## Stop local development dependencies
	$(DOCKER_COMPOSE) down --volumes
	@for port in 1025 8025; do \
		cid=$$(docker ps -q --filter "publish=$$port" 2>/dev/null); \
		if [ -n "$$cid" ]; then \
			echo "Stopping container $$cid occupying port $$port..."; \
			docker stop $$cid; \
		fi; \
	done

clean: ## Remove all build-generated content
	rm -rf ./dist
	rm -f ssr.js

help: ## Display this help.
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
