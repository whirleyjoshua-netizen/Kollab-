const VIDEO_TEMPLATE =
  'By sending, you give {businessName} permission to share this video on their social channels.';
const PHOTO_TEMPLATE =
  'By sending, you give {businessName} permission to share this photo on their social channels.';

export function renderConsentText(
  businessName: string,
  mediaType: 'video' | 'photo' = 'video',
): string {
  const template = mediaType === 'photo' ? PHOTO_TEMPLATE : VIDEO_TEMPLATE;
  return template.replace('{businessName}', businessName);
}
