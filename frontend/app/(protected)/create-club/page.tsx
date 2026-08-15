import CreateClubForm from '@/app/components/club/CreateClubForm';

// import { redirect } from 'next/navigation'
// import { getCurrentUser } from '@/lib/auth'

export default async function CreateClubPage() {

  // const user = await getCurrentUser()

  // if (!user) {
  //   redirect('/?auth=login')
  // }

  return <CreateClubForm />
}