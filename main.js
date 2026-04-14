document.addEventListener("DOMContentLoaded", () => {
    const io = new IntersectionObserver((entries) => {
        entries.forEach(e => { 
            if(e.isIntersecting){ 
                e.target.classList.add('on'); 
                io.unobserve(e.target); 
            } 
        });
    }, { threshold: 0.07, rootMargin: '0px 0px -40px 0px' });
    
    document.querySelectorAll('.rv').forEach(el => io.observe(el));
});
