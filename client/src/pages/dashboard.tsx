import { Navbar } from "@/components/layout/navbar";
import { MOCK_PROJECTS } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Plus, MoreVertical, Clock, Layout } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2">Your Studio</h1>
            <p className="text-muted-foreground">Manage your comic projects and characters.</p>
          </div>
          <Link href="/editor/new">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> New Comic
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MOCK_PROJECTS.map((project) => (
            <Link key={project.id} href={`/editor/${project.id}`}>
              <div className="group relative bg-card rounded-xl border border-white/5 overflow-hidden hover:border-primary/50 transition-all cursor-pointer hover:shadow-2xl hover:shadow-primary/10">
                <div className={`h-48 w-full ${project.thumbnail} relative`}>
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                  <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md px-2 py-1 rounded-md text-xs font-medium border border-white/10">
                    {project.status}
                  </div>
                </div>
                
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold font-display group-hover:text-primary transition-colors">
                      {project.title}
                    </h3>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-4">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {project.updatedAt}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Layout className="w-3.5 h-3.5" />
                      {project.panels} Panels
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          
          {/* Create New Card Placeholder */}
          <Link href="/editor/new">
            <div className="h-full min-h-[300px] border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer gap-4">
              <div className="w-16 h-16 rounded-full bg-background border border-white/10 flex items-center justify-center">
                <Plus className="w-8 h-8" />
              </div>
              <span className="font-medium">Create New Project</span>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}