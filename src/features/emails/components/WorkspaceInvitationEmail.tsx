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
import type { WorkspaceInvitationDisplayData } from '@/features/workspaces/WorkspaceInvitation';
import { workspaceInvitationCopy } from '@/features/workspaces/WorkspaceInvitation';
import { AppConfig } from '@/utils/AppConfig';

const bodyStyle = {
  backgroundColor: '#f5f5f3',
  color: '#2f3437',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  margin: '0',
  padding: '32px 12px',
};

const containerStyle = { margin: '0 auto', maxWidth: '560px' };
const brandStyle = { marginBottom: '20px', textAlign: 'center' as const };
const brandMarkStyle = {
  backgroundColor: '#2f3437',
  borderRadius: '10px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '18px',
  fontWeight: '700',
  height: '36px',
  lineHeight: '36px',
  margin: '0 10px 0 0',
  textAlign: 'center' as const,
  width: '36px',
};
const brandNameStyle = {
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0',
  verticalAlign: '10px',
};
const cardStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e7e7e4',
  borderRadius: '16px',
  padding: '36px',
};
const eyebrowStyle = {
  color: '#2383e2',
  fontSize: '12px',
  fontWeight: '700',
  letterSpacing: '0.08em',
  margin: '0 0 12px',
};
const headingStyle = {
  color: '#202124',
  fontSize: '28px',
  lineHeight: '36px',
  margin: '0 0 16px',
};
const introStyle = { color: '#666a70', fontSize: '15px', lineHeight: '24px', margin: '0' };
const detailsStyle = {
  backgroundColor: '#f8f8f6',
  borderRadius: '12px',
  margin: '28px 0',
  padding: '18px 20px',
};
const detailLabelStyle = { color: '#777b80', fontSize: '12px', margin: '0 0 4px' };
const detailValueStyle = {
  color: '#202124',
  fontSize: '15px',
  fontWeight: '600',
  margin: '0',
};
const detailDividerStyle = { borderColor: '#e7e7e4', margin: '14px 0' };
const buttonStyle = {
  backgroundColor: '#2f3437',
  borderRadius: '9px',
  color: '#ffffff',
  display: 'block',
  fontSize: '15px',
  fontWeight: '600',
  padding: '13px 20px',
  textAlign: 'center' as const,
  textDecoration: 'none',
};
const expirationStyle = {
  color: '#777b80',
  fontSize: '13px',
  margin: '14px 0 0',
  textAlign: 'center' as const,
};
const dividerStyle = { borderColor: '#e7e7e4', margin: '28px 0 20px' };
const fallbackStyle = { color: '#777b80', fontSize: '12px', lineHeight: '19px', margin: '0 0 6px' };
const linkStyle = {
  color: '#2383e2',
  fontSize: '12px',
  lineHeight: '19px',
  wordBreak: 'break-all' as const,
};
const footerStyle = {
  color: '#8b8e92',
  fontSize: '12px',
  lineHeight: '19px',
  margin: '20px 24px 0',
  textAlign: 'center' as const,
};

/**
 * Renders the email-client-compatible workspace invitation view.
 *
 * @param props - Acceptance URL and shared invitation display data.
 * @returns The React Email document passed to Resend.
 */
export function WorkspaceInvitationEmail(props: {
  acceptUrl: string;
  invitation: WorkspaceInvitationDisplayData;
}) {
  return (
    <Html lang="zh-CN">
      <Head />
      <Preview>
        {props.invitation.inviterName} 邀请你加入 {props.invitation.workspaceName}
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={brandStyle}>
            <Text style={brandMarkStyle}>K</Text>
            <Text style={brandNameStyle}>{AppConfig.name}</Text>
          </Section>

          <Section style={cardStyle}>
            <Text style={eyebrowStyle}>{workspaceInvitationCopy.eyebrow}</Text>
            <Heading as="h1" style={headingStyle}>
              {workspaceInvitationCopy.title}
            </Heading>
            <Text style={introStyle}>
              {props.invitation.inviterName} 邀请你加入工作区“
              {props.invitation.workspaceName}”。
            </Text>

            <Section style={detailsStyle}>
              <Text style={detailLabelStyle}>工作区</Text>
              <Text style={detailValueStyle}>{props.invitation.workspaceName}</Text>
              <Hr style={detailDividerStyle} />
              <Text style={detailLabelStyle}>加入角色</Text>
              <Text style={detailValueStyle}>{props.invitation.roleLabel}</Text>
              <Hr style={detailDividerStyle} />
              <Text style={detailLabelStyle}>受邀邮箱</Text>
              <Text style={detailValueStyle}>{props.invitation.inviteeEmail}</Text>
            </Section>

            <Button href={props.acceptUrl} style={buttonStyle}>
              {workspaceInvitationCopy.action}
            </Button>
            <Text style={expirationStyle}>邀请将于 {props.invitation.expiresAtLabel} 过期。</Text>

            <Hr style={dividerStyle} />
            <Text style={fallbackStyle}>如果按钮无法打开，请复制以下链接到浏览器：</Text>
            <Link href={props.acceptUrl} style={linkStyle}>
              {props.acceptUrl}
            </Link>
          </Section>

          <Text style={footerStyle}>
            此邮件由 {AppConfig.name} 自动发送。如果你不认识邀请人，可以忽略此邮件。
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
