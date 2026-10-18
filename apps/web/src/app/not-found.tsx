import { HomeLink, StatusPage } from '@/features/reader'

/** Any path the app does not serve (Cloudflare Pages serves this as 404.html). */
export default function NotFound() {
  return <StatusPage line={{ tone: 'plain', text: '404' }} title="This page could not be found." action={<HomeLink />} />
}
