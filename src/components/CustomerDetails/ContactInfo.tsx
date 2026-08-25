"use client";

import { Typography, Box, Skeleton } from "@mui/material";
import { Phone, Hash, Circle } from "lucide-react";

interface ContactInfoProps {
  customer: any;
  contactInfo: any;
  loading: boolean;
}

const ContactInfo = ({ customer, contactInfo, loading }: ContactInfoProps) => {
  const displayEmail =
    contactInfo?.DisplayEmail || contactInfo?.Email || customer?.DisplayEmail || "";
  const mobileNo =
    contactInfo?.MobileNo ||
    contactInfo?.Phone ||
    contactInfo?.ContactNo ||
    customer?.MobileNo ||
    "";
  const about = contactInfo?.About || contactInfo?.Status || customer?.About || "";

  const renderSkeletonRow = () => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      <Skeleton variant="circular" width={36} height={36} sx={{ bgcolor: "#e0e0e0" }} />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width={60} height={16} sx={{ bgcolor: "#e0e0e0" }} />
        <Skeleton variant="text" width={120} height={20} sx={{ bgcolor: "#e0e0e0" }} />
      </Box>
    </Box>
  );

  const renderInfoRow = (icon: React.ReactNode, label: string, value: string) => (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          backgroundColor: "var(--color-hover-bg, #f0f2f5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "text.secondary",
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontSize: "12px", color: "text.secondary", fontWeight: 500 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: "15px", color: "text.primary", fontWeight: 500 }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <div className="info-block contact-info-block">
      <Typography className="block-label">Contact Information</Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, mt: 1.5 }}>
        {loading ? (
          <>
            {renderSkeletonRow()}
            {renderSkeletonRow()}
            {renderSkeletonRow()}
          </>
        ) : (
          <>
            {displayEmail && renderInfoRow(<Hash size={18} />, "User ID", displayEmail)}
            {mobileNo && renderInfoRow(<Phone size={18} />, "Mobile Number", mobileNo)}
            {about && renderInfoRow(<Circle size={18} />, "About", about)}
          </>
        )}
      </Box>
    </div>
  );
};

export default ContactInfo;
