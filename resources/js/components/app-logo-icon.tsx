export default function AppLogoIcon(props: React.SVGAttributes<SVGElement>) {
    return (
        <img
            {...props}
            src="/images/logoBold.svg"
            alt="Logo SupportPC"
            style={{ filter: props.className?.includes('text-white') ? 'brightness(0) invert(1)' : 'none' }}
        />
    );
}
