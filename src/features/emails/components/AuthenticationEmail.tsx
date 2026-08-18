import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { AppConfig } from '@/utils/AppConfig';

const bodyStyle = {
  backgroundColor: '#f5f5f3',
  color: '#2f3437',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  margin: '0',
  padding: '32px 12px',
};
const containerStyle = { margin: '0 auto', maxWidth: '560px' };
const cardStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e7e7e4',
  borderRadius: '16px',
  padding: '36px',
};
const headingStyle = { color: '#202124', fontSize: '28px', margin: '0 0 16px' };
const textStyle = { color: '#666a70', fontSize: '15px', lineHeight: '24px' };
const buttonStyle = {
  backgroundColor: '#2f3437',
  borderRadius: '9px',
  color: '#ffffff',
  display: 'block',
  fontWeight: '600',
  margin: '28px 0',
  padding: '13px 20px',
  textAlign: 'center' as const,
  textDecoration: 'none',
};
const linkStyle = { color: '#2383e2', fontSize: '12px', wordBreak: 'break-all' as const };

/**
 * Renders an email verification or password reset message.
 *
 * @param props - Authentication email content and action URL.
 * @returns The React Email document passed to Resend.
 */
export function AuthenticationEmail(props: {
  actionLabel: string;
  description: string;
  preview: string;
  title: string;
  url: string;
}) {
  return (
    <Html lang="zh-CN">
      <Head />
      <Preview>{props.preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={cardStyle}>
            <Text style={{ fontWeight: '700' }}>{AppConfig.name}</Text>
            <Heading as="h1" style={headingStyle}>
              {props.title}
            </Heading>
            <Text style={textStyle}>{props.description}</Text>
            <Button href={props.url} style={buttonStyle}>
              {props.actionLabel}
            </Button>
            <Hr style={{ borderColor: '#e7e7e4' }} />
            <Text style={{ ...textStyle, fontSize: '12px' }}>
              如果按钮无法打开，请复制以下链接到浏览器：
            </Text>
            <Link href={props.url} style={linkStyle}>
              {props.url}
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
