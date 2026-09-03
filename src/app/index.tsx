import { Counter } from "@/screens/counter";

/**
 * The route at `/`. Thin by design — route files carry route-level concerns only, and this one
 * has none, so it renders the screen body and nothing else.
 */
export default function CounterRoute() {
  return <Counter />;
}
