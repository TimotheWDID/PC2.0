export default function AppLogoIcon(props: React.SVGAttributes<SVGElement>) {
    const logoSrc = "/images/LogoBold.svg";

    return (
        <img
            {...props}
            src={logoSrc}
            alt="Logo SupportPC"
            style={{ filter: props.className?.includes('text-white') ? 'brightness(0) invert(1)' : 'none' }}
        />
    );
}
