import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Mail,
  ArrowLeft,
  KeyRound,
  AlertCircle
} from 'lucide-react';

import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { auth, db } from '../../lib/firebase';
import { User } from '../../types.js';


interface AdminLoginPageProps {
  onAdminAuthenticated: (adminUser: User) => void;
  onBackToSite: () => void;
}


export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onAdminAuthenticated,
  onBackToSite,
}) => {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    setError(null);


    if (!email.trim() || !password) {
      setError("Please provide admin email and password.");
      return;
    }


    setLoading(true);


    try {

      // Firebase Auth Login
      const loginResult = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );


      const uid = loginResult.user.uid;


      // Firestore User Data
      const userRef = doc(db, "users", uid);

      const userSnap = await getDoc(userRef);



      if (!userSnap.exists()) {
        throw new Error(
          "Admin profile not found in database."
        );
      }


      const userData = userSnap.data();



      // Admin Role Check
      if (userData.role !== "admin") {

        throw new Error(
          "Access denied. Only admins can login."
        );

      }


      if (userData.status !== "active") {

        throw new Error(
          "Admin account is disabled."
        );

      }



      const adminUser = {

        id: uid,

        email: loginResult.user.email || "",

        username: userData.username || "",

        avatar: userData.avatar || "",

        role: userData.role,

        status: userData.status,

      } as User;



      onAdminAuthenticated(adminUser);



    } catch (err:any) {


      console.log(err);


      if(err.code === "auth/invalid-credential"){

        setError(
          "Invalid email or password."
        );

      }
      else if(err.code === "auth/user-not-found"){

        setError(
          "Admin account does not exist."
        );

      }
      else {

        setError(
          err.message || "Authentication failed."
        );

      }

    }


    setLoading(false);

  };



  return (

    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">


      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl"/>

      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl"/>



      <div className="max-w-md w-full relative z-10 space-y-6">



        <button
          onClick={onBackToSite}
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition group"
        >

          <ArrowLeft className="w-4 h-4 text-purple-400 group-hover:-translate-x-1"/>

          Return to Public Website

        </button>





        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-6">


          <div className="text-center space-y-2">


            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 p-0.5 shadow-xl flex items-center justify-center">


              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">

                <Shield className="w-7 h-7 text-purple-400"/>

              </div>

            </div>


            <h1 className="text-2xl font-black text-white">
              Admin Console
            </h1>


            <p className="text-xs text-zinc-400">
              Restricted Portal. Authorized Administrators Only.
            </p>


          </div>





          {
            error && (

              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center gap-2">

                <AlertCircle className="w-4 h-4"/>

                {error}

              </div>

            )
          }





          <form onSubmit={handleSubmit} className="space-y-4">


            <div>

              <label className="text-xs font-bold text-zinc-300 flex gap-2 mb-1">

                <Mail className="w-3.5 h-3.5 text-purple-400"/>

                Admin Email

              </label>


              <input

                type="email"

                value={email}

                onChange={(e)=>setEmail(e.target.value)}

                placeholder="dipenshort@gmail.com"

                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:border-purple-500 outline-none"

              />


            </div>





            <div>


              <label className="text-xs font-bold text-zinc-300 flex gap-2 mb-1">

                <KeyRound className="w-3.5 h-3.5 text-purple-400"/>

                Password

              </label>



              <input

                type="password"

                value={password}

                onChange={(e)=>setPassword(e.target.value)}

                placeholder="••••••••"

                className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white focus:border-purple-500 outline-none"

              />


            </div>





            <button

              disabled={loading}

              className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-xs font-bold flex justify-center items-center gap-2 disabled:opacity-50"

            >


              {
                loading ?

                <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                Verifying...
                </>

                :

                <>
                <Lock className="w-4 h-4"/>
                Authenticate Admin
                </>

              }


            </button>



          </form>



        </div>


      </div>


    </div>

  );

};
