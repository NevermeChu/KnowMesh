import { describe, expect, it } from 'vitest';
import { Avatar } from './Avatar';

describe(Avatar, () => {
  it('renders initial letter when image source is absent', () => {
    const element = Avatar({ name: 'Alex Wang' });

    expect(element.type).toBe('span');
    expect(element.props['aria-label']).toBe('Alex Wang');
    expect(element.props.children.props.children).toBe('A');
  });

  it('applies custom size class correctly', () => {
    const element = Avatar({ name: 'John Doe', size: 'lg' });

    expect(element.props.className).toContain('size-10 text-base');
  });
});
