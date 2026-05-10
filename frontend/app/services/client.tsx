import axios from 'axios';
import { User } from '@/app/types';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

const getAuthConfig = () => ({
    headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`
    }
})

export const getUsers = async () => {
    try {
        return await axios.get(
            `${apiBaseUrl}/api/v1/users`,
            getAuthConfig()
        )
    } catch (e) {
        throw e;
    }
}

export const saveUser = async (user : User) => {
    try {
        return await axios.post(
            `${apiBaseUrl}/api/v1/users`,
            user
        )
    } catch (e) {
        throw e;
    }
}