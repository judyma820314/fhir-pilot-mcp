import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { z } from 'zod';

export function registerContentTools(server: McpServer): void {
  // --- generate_fhir_metadata -------------------------------------------
  server.tool(
    'generate_fhir_metadata',
    `Generates a FHIR StructureDefinition (profile) for a given resource type.
Use this as the first step when building FHIR content for inbound integration.
Returns a draft StructureDefinition JSON that can be extended or passed to build_fhir_package.`,
    {
      resource_type: z.string().describe('FHIR R4 resource type (e.g. Patient, Observation, Condition, MedicationRequest)'),
      profile_name: z.string().describe('Name for the custom profile (e.g. SAPPatientProfile)'),
      extensions: z.array(z.string()).optional().describe('Additional extension URLs to include in the profile'),
    },
    async ({ resource_type, profile_name, extensions = [] }) => {
      // TODO: Generate a real StructureDefinition using the FHIR spec validation service
      //   or HAPI FHIR's profile generator

      const profile = {
        resourceType: 'StructureDefinition',
        id: profile_name.toLowerCase().replace(/\s+/g, '-'),
        url: `https://fhir.sap.com/StructureDefinition/${profile_name}`,
        name: profile_name,
        status: 'draft',
        kind: 'resource',
        abstract: false,
        type: resource_type,
        baseDefinition: `http://hl7.org/fhir/StructureDefinition/${resource_type}`,
        derivation: 'constraint',
        differential: {
          element: [
            { id: resource_type, path: resource_type },
            ...extensions.map((ext, i) => ({
              id: `${resource_type}.extension:custom${i}`,
              path: `${resource_type}.extension`,
              sliceName: `custom${i}`,
              type: [{ code: 'Extension', profile: [ext] }],
              min: 0,
              max: '1',
            })),
          ],
        },
        _mock: true,
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(profile, null, 2) }],
      };
    },
  );

  // --- generate_fhir_data -------------------------------------------
  server.tool(
    'generate_fhir_data',
    `Generates sample FHIR resource instances for testing and validation.
Returns one or more FHIR resource JSON objects conforming to the specified resource type and optional profile.
Use this to produce test data before deploying content to HDSF.`,
    {
      resource_type: z.string().describe('FHIR R4 resource type (e.g. Patient, Observation, Practitioner)'),
      count: z.number().min(1).max(50).optional().describe('Number of sample resources to generate. Default 1.'),
      profile_url: z.string().optional().describe('Profile URL the generated resources should conform to'),
    },
    async ({ resource_type, count = 1, profile_url }) => {
      // TODO: Use a FHIR synthetic data generator (e.g. Synthea or HAPI test data builder)

      const resources = Array.from({ length: count }, (_, i) => ({
        resourceType: resource_type,
        id: `mock-${resource_type.toLowerCase()}-${String(i + 1).padStart(3, '0')}`,
        meta: {
          profile: profile_url ? [profile_url] : [],
          lastUpdated: new Date().toISOString(),
        },
        ...(resource_type === 'Patient' && {
          name: [{ family: `TestFamily${i + 1}`, given: [`TestGiven${i + 1}`] }],
          birthDate: '1980-01-01',
          gender: i % 2 === 0 ? 'male' : 'female',
          identifier: [{ system: 'https://fhir.sap.com/patient-id', value: `P-${1000 + i}` }],
        }),
        ...(resource_type === 'Observation' && {
          status: 'final',
          code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' }] },
          subject: { reference: `Patient/mock-patient-${String(i + 1).padStart(3, '0')}` },
          valueQuantity: { value: 120 + i, unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' },
        }),
        _mock: true,
      }));

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ count, resources }, null, 2) }],
      };
    },
  );

  // --- build_fhir_package -------------------------------------------
  server.tool(
    'build_fhir_package',
    `Assembles FHIR profiles, extensions, and value sets into a deployable FHIR NPM package.
The package format is compatible with HDSF's package loader.
Returns a package manifest. Pass the package name and version to deploy_fhir_package.`,
    {
      package_name: z.string().describe('Package identifier (e.g. sap.fhir.mypackage)'),
      version: z.string().describe('Semantic version (e.g. 1.0.0)'),
      resource_ids: z.array(z.string()).describe('List of FHIR resource IDs or StructureDefinition names to bundle'),
      dependencies: z.array(z.object({ name: z.string(), version: z.string() })).optional()
        .describe('FHIR package dependencies (e.g. hl7.fhir.r4.core@4.0.1)'),
    },
    async ({ package_name, version, resource_ids, dependencies = [] }) => {
      // TODO: Build a real FHIR NPM package .tgz with:
      //   package/package.json, package/index.json, package/<resource>.json per resource

      const manifest = {
        name: package_name,
        version,
        type: 'fhir.ig',
        fhirVersions: ['4.0.1'],
        dependencies: Object.fromEntries(dependencies.map(d => [d.name, d.version])),
        files: resource_ids.map(id => `${id}.json`),
        resourceCount: resource_ids.length,
        _mock: true,
        _note: 'In production: generates a valid FHIR NPM .tgz ready for HDSF upload',
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ status: 'built', package: manifest }, null, 2) }],
      };
    },
  );

  // --- validate_fhir_compliance -------------------------------------------
  server.tool(
    'validate_fhir_compliance',
    `Validates a FHIR resource against the HL7 FHIR R4 specification and an optional profile.
Returns a list of errors and warnings (OperationOutcome style).
Always run this before deploying a package to HDSF.`,
    {
      resource_json: z.string().describe('FHIR resource JSON string to validate'),
      profile_url: z.string().optional().describe('Profile URL to validate against (uses base spec if omitted)'),
    },
    async ({ resource_json, profile_url }) => {
      // TODO: POST {hdsf_url}/fhir/R4/$validate or call HAPI FHIR validator

      let resource: Record<string, unknown>;
      try {
        resource = JSON.parse(resource_json);
      } catch {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ valid: false, issues: [{ severity: 'error', details: 'Invalid JSON' }] }) }],
        };
      }

      const issues: Array<{ severity: string; code: string; details: string }> = [];
      if (!resource.resourceType) issues.push({ severity: 'error', code: 'required', details: 'Missing resourceType' });
      if (!resource.id) issues.push({ severity: 'warning', code: 'recommended', details: 'id is recommended' });

      const result = {
        valid: issues.filter(i => i.severity === 'error').length === 0,
        resource_type: resource.resourceType ?? 'unknown',
        profile: profile_url ?? `http://hl7.org/fhir/StructureDefinition/${resource.resourceType ?? 'Resource'}`,
        issues,
        _mock: true,
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // --- deploy_fhir_package -------------------------------------------
  server.tool(
    'deploy_fhir_package',
    `Deploys a validated FHIR package to an HDSF instance.
After deployment the profiles and extensions in the package are active on the FHIR server.
Use validate_fhir_compliance before deploying.`,
    {
      instance_id: z.string().describe('HDSF instance ID (from create_hdsf_instance)'),
      package_name: z.string().describe('FHIR package name (e.g. sap.fhir.mypackage)'),
      package_version: z.string().describe('Package version to deploy (e.g. 1.0.0)'),
    },
    async ({ instance_id, package_name, package_version }) => {
      // TODO: POST {hdsf_url}/fhir/R4/$load-package with package .tgz
      //   Authorization: Bearer {btp_token}

      const result = {
        success: true,
        instance_id,
        package: `${package_name}@${package_version}`,
        deployed_at: new Date().toISOString(),
        status: 'active',
        fhir_base_url: `https://hdsf-${instance_id}.cfapps.eu10.hana.ondemand.com/fhir/R4`,
        _mock: true,
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // --- resolve_fhir_issues -------------------------------------------
  server.tool(
    'resolve_fhir_issues',
    `Diagnoses errors encountered during FHIR content generation or HDSF deployment.
Returns the root cause and step-by-step remediation instructions.
Use this when generate, build, or deploy steps return errors.`,
    {
      error_message: z.string().describe('The full error message or description of the problem'),
      context: z.enum(['profile', 'data', 'deployment', 'validation', 'general']).optional()
        .describe('Phase in which the error occurred'),
    },
    async ({ error_message, context = 'general' }) => {
      // TODO: Query SAP Help Portal + FHIR spec via RAG to provide accurate root cause analysis

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: error_message,
            context,
            diagnosis: '[MOCK] Root cause analysis based on FHIR spec and HDSF documentation.',
            suggested_fix: '[MOCK] Step-by-step remediation instructions.',
            references: [
              'https://hl7.org/fhir/R4/operationoutcome.html',
              'https://help.sap.com/docs/SAP_HEALTH_DATA_SERVICES_FOR_FHIR',
            ],
            _mock: true,
          }, null, 2),
        }],
      };
    },
  );
}
