import type { TutorialDefinition } from "@/lib/tutorial";

export const profileTutorial: TutorialDefinition = {
  id: "profile",
  title: "Profile",
  description: "Update your name, avatar, and password.",
  route: "/profile",
  audience: "all",
  steps: [
    {
      id: "welcome",
      title: "Your profile",
      body: "Update how you appear to teammates in session editors, reviews, and proposals.",
      placement: "center",
    },
    {
      id: "avatar",
      title: "Avatar",
      target: "profile-avatar",
      placement: "bottom",
      body: "Pick an avatar shown next to your name across the app.",
    },
    {
      id: "details",
      title: "Name and email",
      target: "profile-details",
      placement: "bottom",
      body: "Update your display name. Email is used for sign-in and team invites.",
    },
    {
      id: "password",
      title: "Password",
      target: "profile-password",
      placement: "top",
      body: "Change your password if you signed up with email and password.",
    },
  ],
};
