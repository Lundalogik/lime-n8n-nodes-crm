## [1.0.2](https://github.com/Lundalogik/lime-n8n-nodes-crm/compare/v1.0.1...v1.0.2) (2026-09-25)


### Bug Fixes

* fix bulk import serialization error ([0c75c3f](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/0c75c3fa3c13efed88dd6b647a125a36b7cce691))

## [1.0.1](https://github.com/Lundalogik/lime-n8n-nodes-crm/compare/v1.0.0...v1.0.1) (2026-09-25)


### Bug Fixes

* **credentials:** point documentationUrl at a page that resolves ([d8154f5](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/d8154f5d3042f5209984829d649cdd92a55674c0))
* enhance HMAC verification with constant-time comparison and add tests for verifyRequest ([09e2c01](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/09e2c01c2f09353d543f22b04156cb266221b28f))

# 1.0.0 (2026-09-24)


### Bug Fixes

* add the subtitle the trigger description is required to have ([62f401f](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/62f401fd61b47b092d7cfd05253fc5a15b4f4685))
* apply the autofixable n8n community lint rules ([5e46c15](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/5e46c15b7fd67b02634928fda0bf80d8a2ef4816))
* document why the credential test keeps the request helper ([1d0edb2](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/1d0edb2794d30cd5513a20b4856e6fce87641301))
* drop the unused index parameter in the bulk import payload mapping ([cf8071e](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/cf8071e7326e87992586e4d9181d04b4a7d08bee))
* keep item pairing on continue-on-fail error items ([689e3ad](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/689e3ad12d026d5ca05134a3ec17b68986a70501))
* move webhook secret to credentials ([d33a887](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/d33a88747d920ed632367ba0659ce14d1f6bc85c))
* poll the bulk import job with n8n's sleep helper ([67f7aaf](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/67f7aaf866ea23c23a8e73d4192ae73f71edd427))
* resolve the duplicate description key left on the bulk import matching property ([d1d6345](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/d1d634504474aba555d7fb12e361f783014779a9))
* resolve the duplicate description key on the Get Many Objects limit ([89a7e99](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/89a7e991b19ed2bdc473fa521c24464967f718e8))
* restore lime-n8n's limit parameters that the autofixer rewrote ([b0aa300](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/b0aa300bd43d9143e69474517b8bab60e66162fe))
* restore the dropdown labels the n8n autofixer reworded ([4b42ec3](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/4b42ec3fbd51a7f08e7b1f874b2729831111c6ac))
* rethrow caught errors as NodeApiError or NodeOperationError ([35deed2](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/35deed2ef26ac9479131a0f8f71082d8d2d7ba33))
* sort the user-type options case-insensitively as the lint rule expects ([03dacad](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/03dacada2fbe65e2773ea34937b33614d1cb36c7))
* word the Accept Null for Texts description as the boolean rule requires ([53eb907](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/53eb90758d478a98faa79f0a06675ed4e64080d9))


### Features

* **credentials:** remove the openssl hint from the webhook secret texts ([bd656f2](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/bd656f2aad6fe4f616e6aaa74fbdafc15c76a1f6))
* **lime-crm:** add option to accept null for text properties ([06a3cd5](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/06a3cd5a0c3cd3dcc78769eefc5c686cd3ebfd31))
* move the Lime CRM nodes, credential and tests from lime-n8n ([8c86c2d](https://github.com/Lundalogik/lime-n8n-nodes-crm/commit/8c86c2da37fe901722c77ba3ff81d23a2e7156fe))
