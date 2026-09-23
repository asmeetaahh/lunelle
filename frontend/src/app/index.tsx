import { Redirect } from 'expo-router'

import { useAuth } from '@/auth'

// "/" is not a real screen: it just sends the user to the right group.
export default function Index() {
  const { status } = useAuth()
  return <Redirect href={status === 'signedIn' ? '/today' : '/welcome'} />
}
