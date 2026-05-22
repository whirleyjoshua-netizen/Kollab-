import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

type QrCardPdfProps = {
  businessName: string;
  qrPngDataUrl: string; // data:image/png;base64,...
  size: 'letter' | 'a4';
};

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    backgroundColor: '#ffffff',
  },
  inner: {
    alignItems: 'center',
    gap: 24,
  },
  brand: {
    fontSize: 36,
    fontWeight: 700,
  },
  prompt: {
    fontSize: 18,
    color: '#444',
    textAlign: 'center',
    maxWidth: 420,
  },
  qr: {
    width: 360,
    height: 360,
  },
  footer: {
    marginTop: 24,
    fontSize: 10,
    color: '#888',
  },
});

export function QrCardPdf({ businessName, qrPngDataUrl, size }: QrCardPdfProps) {
  return (
    <Document>
      <Page size={size === 'a4' ? 'A4' : 'LETTER'} style={styles.page}>
        <View style={styles.inner}>
          <Text style={styles.brand}>{businessName}</Text>
          <Text style={styles.prompt}>
            Scan to share a quick video of your experience
          </Text>
          <Image src={qrPngDataUrl} style={styles.qr} />
          <Text style={styles.footer}>Powered by Kollab</Text>
        </View>
      </Page>
    </Document>
  );
}
