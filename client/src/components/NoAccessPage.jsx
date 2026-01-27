import { Button } from "@heroui/react"
import React from "react"
import { LuFileLock2 } from "react-icons/lu"
import { useNavigate } from "react-router"

function NoAccessPage() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <LuFileLock2 size={48} className="text-foreground-700 mb-4" />
      <h1 className="text-2xl font-tw font-bold">No Access</h1>
      <p className="text-lg">You do not have access to this page. Contact your team admin to get access.</p>
      <Button
        color="primary"
        onPress={() => navigate("/")}
      >
        Go to dashboard
      </Button>
    </div>
  )
}

export default NoAccessPage
