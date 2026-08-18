import { describe, expect, it } from 'vitest';
import { FormField } from './FormField';

describe(FormField, () => {
  it('renders field label and child content', () => {
    const element = FormField({
      children: 'Input placeholder',
      htmlFor: 'test-id',
      label: 'Username',
    });

    const [labelElement, childElement] = element.props.children;

    expect(element.type).toBe('div');
    expect(labelElement?.props.children[0]).toBe('Username');
    expect(childElement).toBe('Input placeholder');
  });

  it('renders error message in alert role', () => {
    const element = FormField({
      children: 'Input placeholder',
      error: 'Invalid format',
    });

    const messageElement = element.props.children.at(-1);

    expect(messageElement.props.error).toBe('Invalid format');
  });
});
