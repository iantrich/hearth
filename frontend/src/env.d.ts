declare module "*.css?inline" {
  const css: string;
  export default css;
}

declare module "*.css?raw" {
  const css: string;
  export default css;
}

// Python source as text: the limits test reads service.py's MAX_TEXT_LENGTHS.
declare module "*.py?raw" {
  const text: string;
  export default text;
}
