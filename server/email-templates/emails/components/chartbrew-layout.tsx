import * as React from "react";
import { Body, Container, Head, Html, Link, Preview, Section, Text } from "@react-email/components";

export type ChartbrewLayoutProps = {
  previewText: string;
  browserUrl?: string;
  children: React.ReactNode;
};

export default function ChartbrewLayout(props: ChartbrewLayoutProps) {
  const { previewText, browserUrl, children } = props;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.frame}>
          <Section style={styles.topRow}>
            <Text style={styles.topCopy}>{previewText}</Text>
            <Text style={styles.topLinkWrap}>
              {browserUrl ? (
                <Link href={browserUrl} style={styles.topLink}>
                  View in browser
                </Link>
              ) : null}
            </Text>
          </Section>

          <Section style={styles.card}>{children}</Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: "#efeff1",
    margin: "0",
    padding: "32px 16px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    color: "#111827",
  },
  frame: {
    margin: "0 auto",
    maxWidth: "980px",
    width: "100%",
  },
  topRow: {
    width: "100%",
    marginBottom: "20px",
  },
  topCopy: {
    color: "#9ca3af",
    fontSize: "16px",
    lineHeight: "24px",
    margin: "0",
    display: "inline-block",
    width: "72%",
    verticalAlign: "top",
  },
  topLinkWrap: {
    margin: "0",
    display: "inline-block",
    width: "28%",
    textAlign: "right" as const,
    verticalAlign: "top",
  },
  topLink: {
    color: "#9ca3af",
    textDecoration: "underline",
    fontSize: "16px",
    lineHeight: "24px",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    padding: "26px",
  },
};
