export function SkeletonLine({ className = "", as: Component = "span" }) {
  return (
    <Component aria-hidden="true" className={["skeleton", className].filter(Boolean).join(" ")} />
  );
}
