import { href } from '../lib/router'

export function NotFound() {
  return (
    <div class="page narrow notfound">
      <h1>Packet dropped</h1>
      <p class="lede">There is nothing at this address. TTL exceeded, perhaps.</p>
      <a class="btn primary" href={href('/')}>Back to the course</a>
    </div>
  )
}
