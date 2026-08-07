import Image from 'next/image';

/**
 * Displays the shared product icon.
 *
 * @param props - Icon styling.
 * @returns The product icon.
 */
export function AppLogo(props: { className: string }) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={props.className}
      height={180}
      src="/apple-touch-icon.png"
      width={180}
    />
  );
}
