import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <div className="p-2">
      <h3>About PDF Scrapper</h3>
      <p>This application helps you extract and process text from PDF documents using AI.</p>
    </div>
  )
}
