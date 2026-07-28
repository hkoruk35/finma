const fs = require('fs');

const path = 'C:/Users/afksm/finma/frontend/components/public/MemberHeader.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add redirection logic for pending users
const fetchSearch = `  useEffect(() => {
    fetch("/api/members/me")
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setIsLoggedIn(true);
      })
      .catch(() => setIsLoggedIn(false))
      .finally(() => setAuthChecked(true));
  }, []);`;

// Actually the exact code is different, let's look for the inside of useEffect
const search1 = `  useEffect(() => {
    fetch("/api/members/me")
      .then(res => setIsLoggedIn(res.ok))
      .catch(() => setIsLoggedIn(false))
      .finally(() => setAuthChecked(true));
  }, []);`;

const replace1 = `  useEffect(() => {
    fetch("/api/members/me")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setIsLoggedIn(true);
          
          // Redirect pending users to account/subscription page to force checkout
          const isPending = data.member?.subscription_status === 'pending';
          const isAccountPage = pathname.includes('/account') || pathname.includes('/hesabim') || pathname.includes('/cuenta') || pathname.includes('/compte') || pathname.includes('/conta');
          
          if (isPending && !isAccountPage) {
             const accountHref = locale === "tr" ? "/global/tr/hesabim" : locale === "es" ? "/global/es/account" : locale === "fr" ? "/global/fr/account" : locale === "pt" ? "/global/pt/account" : "/global/en/account";
             window.location.href = accountHref + '?tab=subscription';
          }
        } else {
          setIsLoggedIn(false);
        }
      })
      .catch(() => setIsLoggedIn(false))
      .finally(() => setAuthChecked(true));
  }, [pathname, locale]);`;

content = content.replace(search1, replace1);

fs.writeFileSync(path, content, 'utf8');
console.log("Updated MemberHeader");
