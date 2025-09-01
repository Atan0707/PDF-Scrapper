import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

export const Route = createRootRoute({
  component: () => (
    <>
      <div className="p-2 flex gap-2 bg-gray-100 border-b">
        <Link to="/" className="[&.active]:font-bold hover:text-blue-600 px-2 py-1">
          Home
        </Link>
        <Link to="/about" className="[&.active]:font-bold hover:text-blue-600 px-2 py-1">
          About
        </Link>
        <Link to="/test" className="[&.active]:font-bold hover:text-blue-600 px-2 py-1">
          Test
        </Link>
      </div>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})
