/// <reference types="vite/client" />

declare module "*.json" {
    const value: any;
    export default value;
}

declare module '*.mp4' {
    const src: string;
    export default src;
}

declare module '*.webm' {
    const src: string;
    export default src;
}

declare module '*.mov' {
    const src: string;
    export default src;
}
