# FHIRPilot MCP Server

An MCP (Model Context Protocol) server that exposes SAP Health Data Services for FHIR (HDSF) and FHIR R4 operations as AI-callable tools — built to demonstrate agentic AI development in the SAP healthcare integration context.

## What this is

FHIRPilot wraps HDSF and FHIR operations as tools that an AI agent (like Claude) can call directly. It was built to explore how agentic AI can assist engineers and partners working with FHIR data and the HDSF platform on SAP BTP.

All tools currently use mock implementations with real interface contracts — the tool signatures, inputs, and outputs match what a production integration would look like.

## Tools

### FHIR Content
| Tool | Description |
|------|-------------|
| `generate_fhir_metadata` | Generates a FHIR R4 StructureDefinition (profile) for a given resource type |
| `generate_fhir_data` | Generates sample FHIR resource instances for testing |
| `build_fhir_package` | Assembles FHIR profiles into a deployable FHIR NPM package |
| `validate_fhir_compliance` | Validates a FHIR resource against the HL7 R4 spec |
| `deploy_fhir_package` | Deploys a validated package to an HDSF instance |
| `resolve_fhir_issues` | Diagnoses FHIR content and deployment errors |

### HDSF Onboarding
| Tool | Description |
|------|-------------|
| `create_hdsf_instance` | Creates a new HDSF instance on SAP BTP |
| `create_service_key` | Creates OAuth credentials for an HDSF instance |
| `get_fhir_info` | Answers questions about FHIR standards and HDSF |

### Integration
| Tool | Description |
|------|-------------|
| `monitor_ingestion` | Monitors FHIR data ingestion from external systems |
| `check_bp_replication` | Checks if a Patient was replicated to S/4HANA as a BusinessPartner |
| `resolve_integration_error` | Diagnoses and resolves FHIR integration pipeline errors |

## Architecture

Built with TypeScript, Express, and the MCP SDK. Stateless — each request creates a fresh MCP server instance.

```
POST /mcp     ← MCP endpoint for AI agents
GET  /health  ← Health check
```

BTP OAuth (Client Credentials flow) is wired up in `src/auth/btp-oauth.ts` — swap the mock for a real xsuaa token call when connecting to a live HDSF instance.

## Running locally

```bash
npm install
cp .env.example .env   # fill in your BTP credentials
npm run build
npm start
```

Server runs on `http://localhost:3000`.

## Context

Built as a demonstration of AI-native development in the SAP healthcare space — specifically around the integration between hospital information systems and SAP S/4HANA via HDSF. The tool design mirrors the real HDSF API surface documented at [help.sap.com](https://help.sap.com/docs/SAP_HEALTH_DATA_SERVICES_FOR_FHIR).

## Tech stack

- TypeScript, Node.js
- Express
- MCP SDK (`@modelcontextprotocol/sdk`)
- SAP BTP / HDSF / xsuaa (OAuth 2.0 Client Credentials flow)
