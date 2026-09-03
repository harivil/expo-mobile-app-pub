import Head from "expo-router/head";

import { Counter } from "@/screens/counter";

/**
 * The route at `/` — a `(tabs)` group is omitted from the URL, so moving this file into the group
 * did not change its address.
 *
 * Thin by design: route files carry route-level concerns only. The document title is exactly that.
 * `Tabs.Screen`'s `title` option sets the tab's label but left `document.title` empty on web
 * (observed, all routes), so the browser tab text comes from `Head` instead — it is focus-aware,
 * which is what makes it correct with tabs.
 */
export default function CounterRoute() {
  return (
    <>
      <Head>
        <title>Counter</title>
      </Head>
      <Counter />
    </>
  );
}
