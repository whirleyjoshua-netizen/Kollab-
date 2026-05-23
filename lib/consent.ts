const TEMPLATE =
  'By sending, you give {businessName} permission to share this video on their social channels.';

export function renderConsentText(businessName: string): string {
  return TEMPLATE.replace('{businessName}', businessName);
}
