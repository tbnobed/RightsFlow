import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, FileSpreadsheet, FileText, Download } from "lucide-react";

export default function Reports() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [reportType, setReportType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const handleGenerateReport = () => {
    if (!reportType || !startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Report Generated",
      description: `${reportType} report has been generated successfully`,
    });
  };

  const handleExport = (format: string) => {
    toast({
      title: "Export Started",
      description: `Exporting report as ${format}...`,
    });
  };

  return (
    <div className="p-6 space-y-6" data-testid="reports-view">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
        <p className="text-muted-foreground">Generate detailed reports and analyze contract performance</p>
      </div>

      {/* Report Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Report Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger data-testid="select-report-type">
                <SelectValue placeholder="Report Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contract-summary">Contract Summary</SelectItem>
                <SelectItem value="royalty-report">Royalty Report</SelectItem>
                <SelectItem value="availability-report">Availability Report</SelectItem>
                <SelectItem value="audit-log">Audit Log</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              data-testid="input-start-date"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              data-testid="input-end-date"
            />
            <Button onClick={handleGenerateReport} data-testid="button-generate">
              <BarChart3 className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chart Placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Territory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Chart: Revenue distribution across territories</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Contract Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground">Chart: Active vs Expired vs In Perpetuity contracts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              onClick={() => handleExport('CSV')}
              data-testid="button-export-csv"
              className="flex items-center justify-center"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
              Export as CSV
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleExport('Excel')}
              data-testid="button-export-excel"
              className="flex items-center justify-center"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
              Export as Excel
            </Button>
            <Button 
              variant="outline" 
              onClick={() => handleExport('PDF')}
              data-testid="button-export-pdf"
              className="flex items-center justify-center"
            >
              <FileText className="h-4 w-4 mr-2 text-red-600" />
              Export as PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
