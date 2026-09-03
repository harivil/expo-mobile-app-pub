import Head from "expo-router/head";

import { Profile } from "@/screens/profile";

/**
 * The route at `/profile`. Thin by design; the document title is the one route-level concern it
 * carries. See the counter route for why this is `Head` rather than the `title` option.
 */
export default function ProfileRoute() {
  return (
    <>
      <Head>
        <title>Profile</title>
      </Head>
      <Profile />
    </>
  );
}
