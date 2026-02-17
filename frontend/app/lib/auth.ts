// import {
//     createContext,
//     useContext,
//     useEffect,
//     useState
// } from "react";
// import {getUsers, login as performLogin} from "@/app/services/client.js";
// import jwtDecode from "jwt-decode";

// const AuthContext = createContext({});

// const AuthProvider = ({ children }) => {

//     const [user, setUser] = useState(null);

//     const setUserFromToken = () => {
//         let token = localStorage.getItem("access_token");
//         if (token) {
//             token = jwtDecode(token);
//             setUser({
//                 username: token.sub,
//                 roles: token.scopes
//             })
//         }
//     }
//     useEffect(() => {
//         setUserFromToken()
//     }, [])


//     const login = async (usernameAndPassword) => {
//         return new Promise((resolve, reject) => {
//             performLogin(usernameAndPassword).then(res => {
//                 const jwtToken = res.headers["authorization"];
//                 localStorage.setItem("access_token", jwtToken);

//                 const decodedToken = jwtDecode(jwtToken);

//                 setUser({
//                     username: decodedToken.sub,
//                     roles: decodedToken.scopes
//                 })
//                 resolve(res);
//             }).catch(err => {
//                 reject(err);
//             })
//         })
//     }

//     const logOut = () => {
//         localStorage.removeItem("access_token")
//         setUser(null)
//     }

//     const isUserAuthenticated = () => {
//         const token = localStorage.getItem("access_token");
//         if (!token) {
//             return false;
//         }
//         const { exp: expiration } = jwtDecode(token);
//         if (Date.now() > expiration * 1000) {
//             logOut()
//             return false;
//         }
//         return true;
//     }

//     return (
//         <AuthContext.Provider value={{
//             user,
//             login,
//             logOut,
//             isUserAuthenticated,
//             setUserFromToken
//         }}>
//             {children}
//         </AuthContext.Provider>
//     )
// }

// export const useAuth = () => useContext(AuthContext);

// export default AuthProvider;



// import React, { useEffect, useState } from 'react';
// import axios from 'axios';

// function MyComponent() {
//   const [data, setData] = useState(null);
//   const [error, setError] = useState(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         const response = await axios.get('https://api.example.com/data');
//         setData(response.data);
//       } catch (err) {
//         setError(err);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchData();
//   }, []);

//   if (loading) return <div>Loading...</div>;
//   if (error) return <div>Error: {error.message}</div>;

//   return (
//     <div>
//       <h1>Data:</h1>
//       <pre>{JSON.stringify(data, null, 2)}</pre>
//     </div>
//   );
// }

// export default MyComponent;