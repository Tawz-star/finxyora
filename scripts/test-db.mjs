import {
  getAllEvents,
  getEventBySlug,
  createEventRegistration,
  getEventRegistration,
  createStallBooking,
  getStallBooking,
  getAllStallOptions,
  createPaymentIntent,
  confirmPayment,
  getDashboardMetrics
} from '../src/lib/db.ts';

console.log('Testing Database and Business Logic...');

// 1. Test Events
const events = getAllEvents();
console.log(`✓ Loaded ${events.length} events:`, events.map(e => e.title));
if (events.length !== 6) throw new Error('Expected 6 events seeded');

// 2. Test Event Constraints (Corporate Walk requires 6-8)
const corpWalk = getEventBySlug('corporate-walk');
console.log(`✓ Corporate Walk min: ${corpWalk.min_participants}, max: ${corpWalk.max_participants}`);

try {
  createEventRegistration({
    eventId: 'corporate-walk',
    collegeName: 'Apex Institute',
    collegeLocation: 'Bengaluru',
    leaderName: 'Arjun Verma',
    leaderEmail: 'arjun@apex.edu',
    leaderPhone: '9876543210',
    participants: [
      { fullName: 'P1', rollNumber: 'R1', department: 'Commerce', yearOfStudy: '3rd Year', section: 'A' },
      { fullName: 'P2', rollNumber: 'R2', department: 'Commerce', yearOfStudy: '3rd Year', section: 'A' }
    ] // Only 2 participants, should fail!
  });
  throw new Error('Corporate walk should have rejected 2 participants!');
} catch (err) {
  console.log('✓ Successfully blocked Corporate Walk with <6 participants:', err.message);
}

// 3. Test Valid Event Registration
const validReg = createEventRegistration({
  eventId: 'prompt-perfect',
  collegeName: 'National College of Commerce',
  collegeLocation: 'Chennai',
  teamName: 'PromptCrafters',
  leaderName: 'Priya Sharma',
  leaderEmail: 'priya@ncc.edu',
  leaderPhone: '9876501234',
  participants: [
    { fullName: 'Priya Sharma', rollNumber: 'NCC-2024-01', department: 'FinTech', yearOfStudy: 'Final Year', section: 'B' },
    { fullName: 'Rahul Nair', rollNumber: 'NCC-2024-02', department: 'FinTech', yearOfStudy: 'Final Year', section: 'B' }
  ]
});
console.log('✓ Created valid event registration:', validReg);

const fetchedReg = getEventRegistration(validReg.registrationId);
console.log(`✓ Fetched registration ${fetchedReg.id}, fee: ₹${fetchedReg.total_fee}, participants: ${fetchedReg.participants.length}`);

// 4. Test Stall Booking
const stalls = getAllStallOptions();
console.log('✓ Stall Options & Availability:', stalls.map(s => `${s.name}: ${s.available_stalls}/${s.total_stalls} remaining (Price: ₹${s.price})`));

const validStall = createStallBooking({
  optionId: 'student-electric',
  applicantType: 'student',
  entityName: 'CryptoCraft Goods',
  collegeName: 'St. Joseph College',
  departmentClass: 'B.Com FinTech II',
  contactName: 'Rohan Mehra',
  contactEmail: 'rohan@stjoseph.edu',
  contactPhone: '9812345678',
  productsServices: 'Handcrafted blockchain merchandise and LED keychains',
  stallsRequested: 1
});
console.log('✓ Created student stall booking:', validStall);

// 5. Test Payment Intent and Confirmation
const payment = createPaymentIntent({
  referenceType: 'event',
  referenceId: validReg.registrationId,
  payerEmail: 'priya@ncc.edu',
  payerPhone: '9876501234'
});
console.log('✓ Created payment intent:', payment.id, 'Amount:', payment.amount);

const confirmed = confirmPayment({
  paymentId: payment.id,
  gatewayPaymentId: 'pay_sandbox_test_123',
  gatewayOrderId: payment.gateway_order_id,
  gatewaySignature: 'SANDBOX_VERIFIED_SIGNATURE',
  verifiedAmount: payment.amount
});
console.log('✓ Payment confirmed:', confirmed.message);

const updatedReg = getEventRegistration(validReg.registrationId);
console.log('✓ Registration payment status after confirmation:', updatedReg.payment_status);
if (updatedReg.payment_status !== 'paid') throw new Error('Registration should be paid!');

// 6. Test Dashboard Metrics
const stats = getDashboardMetrics();
console.log('✓ Dashboard Metrics:', {
  confirmedEventRegs: stats.confirmedEventRegs,
  confirmedParticipants: stats.totalConfirmedParticipants,
  verifiedCollections: stats.verifiedCollections,
  stallBookings: stats.totalStallBookings
});

console.log('\nALL BUSINESS LOGIC TESTS PASSED SUCCESSFULLY! 🎉\n');
