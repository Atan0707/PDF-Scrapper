import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/test')({
  component: Test,
})

function Test() {
  return (
    <div className="p-2">
      <h3>Test Page</h3>
      <p>This is a test page for TanStack Router.</p>
    </div>
  )
}
