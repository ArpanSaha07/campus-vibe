import CreateEventForm from '@/app/components/event/CreateEventForm';

// import { redirect } from 'next/navigation'
// import { getCurrentUser } from '@/lib/auth'

export default async function CreateEventPage() {

  // const user = await getCurrentUser()

  // if (!user) {
  //   redirect('/?auth=login')
  // }

  return <CreateEventForm />
}