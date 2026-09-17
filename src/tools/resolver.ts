import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { z } from 'zod';

export function registerResolverTools(server: McpServer): void {
  // --- monitor_ingestion -------------------------------------------
  server.tool(
    'monitor_ingestion',
    `Monitors FHIR data ingestion from an external system into an HDSF instance.
Returns a summary of message processing status, failed messages with error details, and throughput metrics.
Use this to check whether inbound integration is working, or to find errors to resolve.`,
    {
      instance_id: z.string().describe('HDSF instance ID to monitor'),
      time_range_minutes: z.number().min(1).max(1440).optional()
        .describe('Lookback window in minutes. Default 60.'),
      resource_type: z.string().optional()
        .describe('Filter results by FHIR resource type (e.g. Patient, Observation)'),
    },
    async ({ instance_id, time_range_minutes = 60, resource_type }) => {
      // TODO: Query SAP Integration Suite monitoring API:
      //   GET {integration_suite_url}/api/v1/MessageProcessingLogs
      //     ?$filter=Status ne 'COMPLETED' and StartTime ge datetime'{since}'
      //   Or query HDSF audit log endpoint

      const result = {
        instance_id,
        time_range_minutes,
        resource_type_filter: resource_type ?? 'all',
        summary: {
          total_messages: 142,
          successful: 138,
          failed: 3,
          processing: 1,
          success_rate: '97.2%',
        },
        recent_errors: [
          {
            id: 'msg-001',
            timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            resource_type: resource_type ?? 'Patient',
            error: 'Referential integrity failure: referenced Practitioner/123 does not exist',
            status: 'failed',
          },
          {
            id: 'msg-002',
            timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
            resource_type: resource_type ?? 'Observation',
            error: 'Profile validation failed: missing required element Observation.subject',
            status: 'failed',
          },
          {
            id: 'msg-003',
            timestamp: new Date(Date.now() - 58 * 60 * 1000).toISOString(),
            resource_type: resource_type ?? 'MedicationRequest',
            error: 'OAuth token expired — 401 Unauthorized from HDSF endpoint',
            status: 'failed',
          },
        ],
        _mock: true,
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // --- resolve_integration_error -------------------------------------------
  server.tool(
    'resolve_integration_error',
    `Diagnoses and optionally auto-resolves common FHIR integration errors in the SAP Integration Suite pipeline.
Covers referential integrity failures, profile validation errors, iFlow misconfigurations, auth failures, rate limits, and schema mismatches.
Set auto_fix=true to attempt automatic remediation where possible.`,
    {
      error_type: z.enum([
        'referential_integrity',
        'profile_validation',
        'iflow_configuration',
        'authentication',
        'rate_limit',
        'schema_mismatch',
        'unknown',
      ]).describe('Type of integration error to resolve'),
      error_details: z.string().describe('Full error message or description from the failed message log'),
      error_id: z.string().optional().describe('Message processing log ID from monitor_ingestion'),
      auto_fix: z.boolean().optional().describe('Attempt automatic remediation. Default false (diagnosis only).'),
    },
    async ({ error_type, error_details, error_id, auto_fix = false }) => {
      // TODO: For auto-fixable errors, call Integration Suite API to:
      //   - Retry failed messages: POST /api/v1/MessageProcessingLogs('{id}')/Retry
      //   - Refresh credentials in iFlow credential store
      //   - Create missing referenced resources in HDSF

      type Resolution = { diagnosis: string; fix: string; auto_fixable: boolean };
      const resolutions: Record<string, Resolution> = {
        referential_integrity: {
          diagnosis: 'A referenced resource does not exist in HDSF. FHIR requires all referenced resources to be present before the referencing resource is created.',
          fix: 'Create the missing referenced resource first (e.g. Practitioner/123), then retry the failed message. Alternatively enable HDSF conditional references to allow forward references.',
          auto_fixable: true,
        },
        profile_validation: {
          diagnosis: 'The incoming FHIR resource does not conform to the declared profile — missing required elements or invalid values.',
          fix: 'Run validate_fhir_compliance on the failing resource to get element-level errors. Update the iFlow mapping to produce the required fields.',
          auto_fixable: false,
        },
        iflow_configuration: {
          diagnosis: 'An iFlow in SAP Integration Suite is misconfigured — wrong HDSF endpoint URL, incorrect content-type header, or broken mapping step.',
          fix: 'Open the iFlow in Integration Suite, verify the HDSF service binding credentials, and redeploy.',
          auto_fixable: true,
        },
        authentication: {
          diagnosis: 'The OAuth access token has expired or the service key credentials stored in the iFlow are invalid.',
          fix: 'Use create_service_key to generate fresh credentials, then update the iFlow credential store and redeploy.',
          auto_fixable: true,
        },
        rate_limit: {
          diagnosis: 'HDSF returned 429 Too Many Requests. The iFlow is sending too many FHIR operations in a short window.',
          fix: 'Add a throttling step to the iFlow, reduce batch size, or switch to HDSF bulk operations ($batch endpoint) to process multiple resources per HTTP call.',
          auto_fixable: false,
        },
        schema_mismatch: {
          diagnosis: 'Source system data does not map to the target FHIR resource structure — wrong data types, missing fields, or unexpected nesting.',
          fix: 'Use generate_fhir_metadata to regenerate the expected StructureDefinition, then update the XSLT or Groovy mapping in the iFlow.',
          auto_fixable: false,
        },
        unknown: {
          diagnosis: 'Error pattern not recognized. Manual investigation required.',
          fix: 'Check the full stack trace in HDSF audit logs and the Integration Suite message processing log for the specific error_id.',
          auto_fixable: false,
        },
      };

      const res = resolutions[error_type];
      const applied = auto_fix && res.auto_fixable;

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error_id: error_id ?? 'n/a',
            error_type,
            error_details,
            diagnosis: res.diagnosis,
            suggested_fix: res.fix,
            auto_fixable: res.auto_fixable,
            action_taken: applied
              ? `[MOCK] Auto-fix applied — ${res.fix}`
              : auto_fix ? 'Auto-fix requested but this error type requires manual intervention.' : 'Diagnosis only.',
            status: applied ? 'resolved' : 'awaiting_manual_action',
            _mock: true,
          }, null, 2),
        }],
      };
    },
  );

  // --- check_bp_replication -------------------------------------------
  server.tool(
    'check_bp_replication',
    `Checks whether a BusinessPartner has been successfully replicated from FHIR data ingestion to S/4HANA Cloud.
Returns the replication status, the originating FHIR Patient resource, and the S/4HANA BusinessPartner record.
Use this to confirm end-to-end data flow after ingestion completes.`,
    {
      business_partner_id: z.string().describe('BusinessPartner ID to look up (e.g. BP-10001)'),
      s4_tenant_url: z.string().optional()
        .describe('S/4HANA Cloud tenant URL. Uses the S4_TENANT_URL env variable if omitted.'),
    },
    async ({ business_partner_id, s4_tenant_url }) => {
      // TODO: Query S/4HANA Cloud OData API:
      //   GET {s4_url}/sap/opu/odata/sap/API_BUSINESS_PARTNER/A_BusinessPartner('{id}')
      //   Also query HDSF audit log to find the originating FHIR Patient resource

      const tenantUrl = s4_tenant_url ?? process.env.S4_TENANT_URL ?? 'https://my-s4hana.ondemand.com';

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            business_partner_id,
            s4_tenant: tenantUrl,
            replication_status: 'replicated',
            replicated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            fhir_source: {
              resource_type: 'Patient',
              fhir_id: `patient-${business_partner_id.toLowerCase()}`,
              last_updated: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
              fhir_url: `${process.env.HDSF_BASE_URL ?? 'https://hdsf.example.com/fhir/R4'}/Patient/patient-${business_partner_id.toLowerCase()}`,
            },
            s4_record: {
              BusinessPartner: business_partner_id,
              BusinessPartnerCategory: '1',
              FirstName: '[MOCK] John',
              LastName: '[MOCK] Doe',
              BusinessPartnerType: '000000',
            },
            sync_errors: [],
            _mock: true,
          }, null, 2),
        }],
      };
    },
  );
}
