import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';

// --- TYPES AND MOCK DATA ---

// Define Leaflet for TypeScript since we are loading it from a CDN
declare const L: any;

type UserRole = 'customer' | 'manager' | 'courier';

interface User {
  id: number;
  username: string;
  password; // In a real app, this would be hashed
  role: UserRole;
  name: string;
}

type OrderStatus = 'new' | 'assigned' | 'in-progress' | 'delivered';

interface Order {
  id: number;
  pickupAddress: string;
  dropoffAddress: string;
  bags: number;
  pickupContactName: string;
  pickupContactPhone: string;
  dropoffContactName: string;
  dropoffContactPhone: string;
  deliveryDate: string;
  deliveryTimeSlot: string;
  status: OrderStatus;
  courierId?: number;
  signature?: string; // base64 data URL
  proofPhoto?: string; // base64 data URL
}

const initialUsers: User[] = [
  { id: 1, username: 'manager', password: '123', role: 'manager', name: 'אבי מנהל' },
  { id: 2, username: 'courier1', password: '123', role: 'courier', name: 'יוסי שליח' },
  { id: 3, username: 'courier2', password: '123', role: 'courier', name: 'משה שליח' },
  { id: 4, username: 'customer', password: '123', role: 'customer', name: 'לקוח לדוגמה' }
];

const mockOrders: Order[] = [
    { id: 1, pickupAddress: 'אלנבי 1, תל אביב', dropoffAddress: 'רוטשילד 10, תל אביב', bags: 1, pickupContactName: 'דנה', pickupContactPhone: '050-1111111', dropoffContactName: 'יעל', dropoffContactPhone: '050-2222222', deliveryDate: '2024-07-28', deliveryTimeSlot: '10:00-12:00', status: 'new' },
    { id: 2, pickupAddress: 'דיזנגוף 100, תל אביב', dropoffAddress: 'אבן גבירול 50, תל אביב', bags: 3, pickupContactName: 'ישראל', pickupContactPhone: '053-9876543', dropoffContactName: 'ישראל', dropoffContactPhone: '053-9876543', deliveryDate: '2024-07-28', deliveryTimeSlot: '12:00-14:00', status: 'new' },
    { id: 3, pickupAddress: 'הרצל 15, תל אביב', dropoffAddress: 'קינג ג\'ורג\' 30, תל אביב', bags: 1, pickupContactName: 'מאיה', pickupContactPhone: '052-5551234', dropoffContactName: 'מאיה', dropoffContactPhone: '052-5551234', deliveryDate: '2024-07-29', deliveryTimeSlot: '14:00-16:00', status: 'assigned', courierId: 2 },
    { id: 4, pickupAddress: 'יהודה הלוי 40, תל אביב', dropoffAddress: 'בן יהודה 200, תל אביב', bags: 5, pickupContactName: 'דוד', pickupContactPhone: '054-7778888', dropoffContactName: 'גוליית', dropoffContactPhone: '054-7779999', deliveryDate: '2024-07-29', deliveryTimeSlot: '16:00-18:00', status: 'in-progress', courierId: 3 },
    { id: 5, pickupAddress: 'המסגר 58, תל אביב', dropoffAddress: 'אחד העם 1, תל אביב', bags: 1, pickupContactName: 'רינה', pickupContactPhone: '058-2345678', dropoffContactName: 'רינה', dropoffContactPhone: '058-2345678', deliveryDate: '2024-07-27', deliveryTimeSlot: '10:00-12:00', status: 'delivered', courierId: 2, signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mP8/wcAAwAB/epv2AAAAABJRU5ErkJggg==' },
];


// --- UTILITY & HELPER FUNCTIONS ---

const STORAGE_KEY_ORDERS = 'yo-yo-delivery-orders';
const STORAGE_KEY_USER = 'yo-yo-delivery-user';
const STORAGE_KEY_USERS_LIST = 'yo-yo-delivery-users-list';

const getInitialData = <T,>(key: string, mockData: T): T => {
    try {
        const stored = localStorage.getItem(key);
        if (stored) {
            return JSON.parse(stored);
        }
        localStorage.setItem(key, JSON.stringify(mockData));
        return mockData;
    } catch (error) {
        console.error(`Failed to parse data for key ${key} from localStorage`, error);
        return mockData;
    }
};

const getInitialUser = (): User | null => {
    try {
        const storedUser = localStorage.getItem(STORAGE_KEY_USER);
        return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
        console.error("Failed to parse user from localStorage", error);
        return null;
    }
};

const geocodeMock = (address: string): [number, number] | null => {
    if (!address || address.trim() === '') return null;
    const lowerCaseAddress = address.toLowerCase();
    
    // Existing known addresses for consistency
    if (lowerCaseAddress.includes('אלנבי 1')) return [32.065, 34.768];
    if (lowerCaseAddress.includes('רוטשילד 10')) return [32.063, 34.770];
    if (lowerCaseAddress.includes('דיזנגוף 100')) return [32.078, 34.775];
    if (lowerCaseAddress.includes('אבן גבירול 50')) return [32.079, 34.781];
    if (lowerCaseAddress.includes('הרצל 15')) return [32.060, 34.767];
    if (lowerCaseAddress.includes('קינג ג\'ורג\' 30')) return [32.074, 34.773];
    if (lowerCaseAddress.includes('יהודה הלוי 40')) return [32.062, 34.773];
    if (lowerCaseAddress.includes('בן יהודה 200')) return [32.086, 34.774];
    if (lowerCaseAddress.includes('המסגר 58')) return [32.059, 34.781];
    if (lowerCaseAddress.includes('אחד העם 1')) return [32.062, 34.767];
    
    // Generic hashing for unknown addresses to place them on the map
    const hash = lowerCaseAddress.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const lat = 32.07 + (hash % 1000) / 20000;
    const lng = 34.77 + (hash % 2000) / 20000;
    return [lat, lng];
};


// --- UI COMPONENTS ---

const Header = ({ user, onLogout }: { user: User, onLogout: () => void }) => (
    <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-yellow-500">YO-YO DELIVERIES</h1>
        <div className="flex items-center space-x-4">
            <span className="text-gray-700">שלום, {user.name}</span>
            <button
                onClick={onLogout}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
            >
                התנתק
            </button>
        </div>
    </header>
);

const CustomerPortal = ({ addOrder }: { addOrder: (order: Omit<Order, 'id' | 'status'>) => void }) => {
    const [pickupAddress, setPickupAddress] = useState('');
    const [dropoffAddress, setDropoffAddress] = useState('');
    const [bags, setBags] = useState(1);
    const [pickupContactName, setPickupContactName] = useState('');
    const [pickupContactPhone, setPickupContactPhone] = useState('');
    const [dropoffContactName, setDropoffContactName] = useState('');
    const [dropoffContactPhone, setDropoffContactPhone] = useState('');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [deliveryTimeSlot, setDeliveryTimeSlot] = useState('');
    const [distance, setDistance] = useState<number | null>(null);

    const mapRef = useRef<any>(null);
    const pickupMarkerRef = useRef<any>(null);
    const dropoffMarkerRef = useRef<any>(null);
    const routeLineRef = useRef<any>(null);

    useEffect(() => {
        if (!mapRef.current) {
            mapRef.current = L.map('map').setView([32.0853, 34.7818], 13); // Tel Aviv center
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapRef.current);
        }
    }, []);

    useEffect(() => {
        const pickupCoords = geocodeMock(pickupAddress);
        const dropoffCoords = geocodeMock(dropoffAddress);

        if (pickupMarkerRef.current) mapRef.current.removeLayer(pickupMarkerRef.current);
        if (dropoffMarkerRef.current) mapRef.current.removeLayer(dropoffMarkerRef.current);
        if (routeLineRef.current) mapRef.current.removeLayer(routeLineRef.current);
        
        pickupMarkerRef.current = null;
        dropoffMarkerRef.current = null;
        routeLineRef.current = null;

        if (pickupCoords) {
            pickupMarkerRef.current = L.marker(pickupCoords).addTo(mapRef.current).bindPopup(`איסוף: ${pickupAddress}`);
        }
        if (dropoffCoords) {
            dropoffMarkerRef.current = L.marker(dropoffCoords).addTo(mapRef.current).bindPopup(`מסירה: ${dropoffAddress}`);
        }

        if (pickupCoords && dropoffCoords) {
            const latlngs = [pickupCoords, dropoffCoords];
            routeLineRef.current = L.polyline(latlngs, { color: 'blue' }).addTo(mapRef.current);
            mapRef.current.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50] });
            const dist = mapRef.current.distance(pickupCoords, dropoffCoords) / 1000;
            setDistance(dist);
        } else if (pickupCoords) {
            mapRef.current.setView(pickupCoords, 15);
            setDistance(null);
        } else if (dropoffCoords) {
            mapRef.current.setView(dropoffCoords, 15);
            setDistance(null);
        } else {
            setDistance(null);
        }

    }, [pickupAddress, dropoffAddress]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!pickupAddress || !dropoffAddress || !pickupContactName || !pickupContactPhone || !dropoffContactName || !dropoffContactPhone || !deliveryDate || !deliveryTimeSlot) {
            alert('נא למלא את כל השדות');
            return;
        }
        addOrder({ pickupAddress, dropoffAddress, bags, pickupContactName, pickupContactPhone, dropoffContactName, dropoffContactPhone, deliveryDate, deliveryTimeSlot });
        setPickupAddress('');
        setDropoffAddress('');
        setBags(1);
        setPickupContactName('');
        setPickupContactPhone('');
        setDropoffContactName('');
        setDropoffContactPhone('');
        setDeliveryDate('');
        setDeliveryTimeSlot('');
        alert('ההזמנה נשלחה בהצלחה!');
    };

    const timeSlots = ["10:00-12:00", "12:00-14:00", "14:00-16:00", "16:00-18:00"];

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">הזמנת משלוח חדש (מהיום להיום)</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-2xl shadow-lg">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <h3 className="text-xl font-semibold border-b pb-2 mb-3">פרטי משלוח</h3>
                        <div>
                            <label htmlFor="pickupAddress" className="block text-sm font-medium text-gray-700">כתובת איסוף</label>
                            <input type="text" id="pickupAddress" value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500" required />
                        </div>
                        <div>
                            <label htmlFor="dropoffAddress" className="block text-sm font-medium text-gray-700">כתובת מסירה</label>
                            <input type="text" id="dropoffAddress" value={dropoffAddress} onChange={e => setDropoffAddress(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-yellow-500 focus:border-yellow-500" required />
                        </div>
                        <h3 className="text-xl font-semibold border-b pb-2 mb-3 pt-4">פרטי יצירת קשר</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="pickupContactName" className="block text-sm font-medium text-gray-700">שם איש קשר באיסוף</label>
                                <input type="text" id="pickupContactName" value={pickupContactName} onChange={e => setPickupContactName(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" required />
                            </div>
                             <div>
                                <label htmlFor="pickupContactPhone" className="block text-sm font-medium text-gray-700">טלפון באיסוף</label>
                                <input type="tel" id="pickupContactPhone" value={pickupContactPhone} onChange={e => setPickupContactPhone(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" required />
                            </div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="dropoffContactName" className="block text-sm font-medium text-gray-700">שם איש קשר במסירה</label>
                                <input type="text" id="dropoffContactName" value={dropoffContactName} onChange={e => setDropoffContactName(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" required />
                            </div>
                             <div>
                                <label htmlFor="dropoffContactPhone" className="block text-sm font-medium text-gray-700">טלפון במסירה</label>
                                <input type="tel" id="dropoffContactPhone" value={dropoffContactPhone} onChange={e => setDropoffContactPhone(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" required />
                            </div>
                        </div>

                         <h3 className="text-xl font-semibold border-b pb-2 mb-3 pt-4">תכולה ותזמון</h3>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-1">
                                <label htmlFor="bags" className="block text-sm font-medium text-gray-700">כמות שקים</label>
                                <input type="number" id="bags" value={bags} onChange={e => setBags(parseInt(e.target.value))} min="1" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" required />
                            </div>
                            <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="deliveryDate" className="block text-sm font-medium text-gray-700">תאריך</label>
                                    <input type="date" id="deliveryDate" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" required />
                                </div>
                                <div>
                                    <label htmlFor="deliveryTimeSlot" className="block text-sm font-medium text-gray-700">שעת איסוף</label>
                                    <select id="deliveryTimeSlot" value={deliveryTimeSlot} onChange={e => setDeliveryTimeSlot(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm" required>
                                        <option value="" disabled>בחר שעה</option>
                                        {timeSlots.map(slot => <option key={slot} value={slot}>{slot}</option>)}
                                    </select>
                                </div>
                            </div>
                         </div>
                        <button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300 text-lg mt-6">הזמן עכשיו</button>
                    </form>
                </div>

                <div className="flex flex-col gap-8">
                    <div id="map" className="h-96 w-full bg-gray-200 rounded-2xl shadow-lg"></div>
                    {distance !== null && (
                         <div className="bg-white p-4 rounded-2xl shadow-lg text-center">
                            <h3 className="text-lg font-semibold text-gray-800">מרחק אווירי מוערך</h3>
                            <p className="text-2xl font-bold text-blue-600">{distance.toFixed(2)} ק"מ</p>
                        </div>
                    )}
                    <div className="bg-blue-100 border-t-4 border-blue-500 rounded-b text-blue-900 px-4 py-3 shadow-md" role="alert">
                        <div className="flex">
                            <div className="py-1"><svg className="fill-current h-6 w-6 text-blue-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M2.93 17.07A10 10 0 1 1 17.07 2.93 10 10 0 0 1 2.93 17.07zm12.73-1.41A8 8 0 1 0 4.34 4.34a8 8 0 0 0 11.32 11.32zM9 11V9h2v6H9v-4zm0-6h2v2H9V5z"/></svg></div>
                            <div>
                            <p className="font-bold">צריכים הצעת מחיר מיוחדת?</p>
                            <p className="text-sm">למשלוחים חריגים (משקל, גודל, דחיפות), אנא פנו ישירות למנהל.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
             <div className="mt-16">
                <h3 className="text-2xl font-bold text-center text-gray-700 mb-8">בין לקוחותינו</h3>
                <div className="p-8 bg-gray-200 rounded-2xl text-center text-gray-500">
                    <p>בקרוב יוצגו כאן לוגואים של לקוחותינו המרוצים.</p>
                </div>
            </div>
        </div>
    );
};


const ManagerPortal = ({ orders, users, updateOrder, addUser }: { orders: Order[], users: User[], updateOrder: (order: Order) => void, addUser: (user: Omit<User, 'id'>) => void }) => {
    const [dateFilter, setDateFilter] = useState('');
    const [courierFilter, setCourierFilter] = useState('');
    const [cityFilter, setCityFilter] = useState('');

    const [showAddUser, setShowAddUser] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newName, setNewName] = useState('');
    const [newRole, setNewRole] = useState<UserRole>('customer');

    const couriers = useMemo(() => users.filter(u => u.role === 'courier'), [users]);

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUsername || !newPassword || !newName || !newRole) {
            alert('נא למלא את כל השדות');
            return;
        }
        addUser({ username: newUsername, password: newPassword, name: newName, role: newRole });
        setNewUsername(''); setNewPassword(''); setNewName(''); setNewRole('customer');
        setShowAddUser(false);
        alert('משתמש חדש נוסף בהצלחה!');
    };

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            const dateMatch = !dateFilter || order.deliveryDate === dateFilter;
            const courierMatch = !courierFilter || order.courierId === parseInt(courierFilter);
            const cityMatch = !cityFilter || order.dropoffAddress.includes(cityFilter);
            return dateMatch && courierMatch && cityMatch;
        });
    }, [orders, dateFilter, courierFilter, cityFilter]);

    const assignCourier = (orderId: number, courierId: string) => {
        const order = orders.find(o => o.id === orderId);
        if (order) {
            updateOrder({ ...order, courierId: parseInt(courierId), status: 'assigned' });
        }
    };

    const OrderCard = ({ order }: { order: Order }) => (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-3">
            <p className="font-bold text-gray-800">הזמנה #{order.id} | {order.deliveryDate}</p>
            <p className="text-sm text-gray-600"><strong>מ:</strong> {order.pickupAddress}</p>
            <p className="text-sm text-gray-600"><strong>ל:</strong> {order.dropoffAddress}</p>
            <p className="text-sm text-gray-600"><strong>איש קשר מסירה:</strong> {order.dropoffContactName} ({order.dropoffContactPhone})</p>
            <p className="text-sm text-gray-600"><strong>שקים:</strong> {order.bags}</p>
             {order.status === 'new' && (
                <div className="mt-2">
                    <select onChange={(e) => assignCourier(order.id, e.target.value)} defaultValue="" className="w-full p-2 border border-gray-300 rounded-md">
                        <option value="" disabled>שייך לשליח...</option>
                        {couriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            )}
             {order.courierId && <p className="text-sm text-blue-600 mt-1"><strong>שליח:</strong> {couriers.find(c => c.id === order.courierId)?.name}</p>}
        </div>
    );

    const columns: { status: OrderStatus, title: string }[] = [
        { status: 'new', title: 'חדשות' },
        { status: 'assigned', title: 'שויכו' },
        { status: 'in-progress', title: 'בביצוע' },
        { status: 'delivered', title: 'נמסרו' }
    ];

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h2 className="text-3xl font-bold text-gray-800">ניהול משלוחים</h2>
                <button onClick={() => setShowAddUser(!showAddUser)} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300">
                    {showAddUser ? 'בטל הוספת משתמש' : 'הוסף משתמש חדש'}
                </button>
            </div>
            {showAddUser && (
                <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                    <h3 className="text-xl font-bold mb-4">הוספת משתמש חדש</h3>
                    <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <input type="text" placeholder="שם משתמש" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="p-2 border rounded" required/>
                        <input type="password" placeholder="סיסמה" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="p-2 border rounded" required/>
                        <input type="text" placeholder="שם מלא" value={newName} onChange={e => setNewName(e.target.value)} className="p-2 border rounded" required/>
                        <select value={newRole} onChange={e => setNewRole(e.target.value as UserRole)} className="p-2 border rounded">
                            <option value="customer">לקוח</option>
                            <option value="courier">שליח</option>
                        </select>
                        <button type="submit" className="bg-blue-500 text-white p-2 rounded">הוסף</button>
                    </form>
                </div>
            )}
            <div className="bg-gray-50 p-4 rounded-lg mb-6 border">
                <h3 className="font-bold text-lg mb-2">סינון הזמנות</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="p-2 border rounded" />
                    <select value={courierFilter} onChange={e => setCourierFilter(e.target.value)} className="p-2 border rounded">
                        <option value="">כל השליחים</option>
                        {couriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input type="text" placeholder="סינון לפי עיר מסירה..." value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="p-2 border rounded" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {columns.map(col => (
                    <div key={col.status} className="bg-gray-100 p-4 rounded-xl min-h-[200px]">
                        <h3 className="font-bold text-lg mb-4 text-center text-gray-700">{col.title} ({filteredOrders.filter(o => o.status === col.status).length})</h3>
                        <div>
                            {filteredOrders.filter(o => o.status === col.status).map(order => <OrderCard key={order.id} order={order} />)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


const CourierPortal = ({ user, orders, updateOrder }: { user: User, orders: Order[], updateOrder: (order: Order) => void }) => {
    const myOrders = orders.filter(o => o.courierId === user.id && (o.status === 'assigned' || o.status === 'in-progress'));
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [orderForProof, setOrderForProof] = useState<Order | null>(null);

    const handleOpenProofModal = (order: Order) => {
        setOrderForProof(order);
        setIsModalOpen(true);
    };

    const handleConfirmDelivery = (proof: {signature?: string; proofPhoto?: string}) => {
        if (orderForProof) {
            updateOrder({ ...orderForProof, status: 'delivered', ...proof });
        }
        setIsModalOpen(false);
        setOrderForProof(null);
    };
    
    const updateStatus = (orderId: number, status: OrderStatus) => {
        const order = orders.find(o => o.id === orderId);
        if (order) {
            updateOrder({ ...order, status });
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-8">
             <h2 className="text-3xl font-bold mb-6 text-gray-800">המשלוחים שלי</h2>
             <div className="space-y-4">
                {myOrders.length > 0 ? myOrders.map(order => (
                    <div key={order.id} className="bg-white p-6 rounded-xl shadow-md border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <p className="font-bold text-xl text-gray-800">הזמנה #{order.id} | {order.deliveryDate} ({order.deliveryTimeSlot})</p>
                            <p className="text-gray-600"><strong>איסוף:</strong> {order.pickupAddress}</p>
                            <p className="text-gray-600"><strong>מסירה:</strong> {order.dropoffAddress}</p>
                            <p className="text-gray-600"><strong>איש קשר מסירה:</strong> {order.dropoffContactName} (<a href={`tel:${order.dropoffContactPhone}`} className="text-blue-600 hover:underline">{order.dropoffContactPhone}</a>)</p>
                            <p className="mt-2 font-semibold text-blue-600">סטטוס: {order.status === 'assigned' ? 'ממתין לאיסוף' : 'בדרך ללקוח'}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                           <a href={`https://www.waze.com/ul?q=${encodeURIComponent(order.status === 'assigned' ? order.pickupAddress : order.dropoffAddress)}`} target="_blank" rel="noopener noreferrer" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300 text-center">נווט עם Waze</a>
                           {order.status === 'assigned' && <button onClick={() => updateStatus(order.id, 'in-progress')} className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300">התחל משלוח</button>}
                           {order.status === 'in-progress' && <button onClick={() => handleOpenProofModal(order)} className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300">המשלוח נמסר</button>}
                        </div>
                    </div>
                )) : (
                    <p className="text-center text-gray-500 text-lg">אין לך משלוחים פעילים כרגע.</p>
                )}
             </div>
             {isModalOpen && orderForProof && (
                <ProofOfDeliveryModal
                    order={orderForProof}
                    onClose={() => setIsModalOpen(false)}
                    onConfirm={handleConfirmDelivery}
                />
            )}
        </div>
    );
};

const ProofOfDeliveryModal = ({ order, onClose, onConfirm }: { order: Order, onClose: () => void, onConfirm: (proof: {signature?: string, proofPhoto?: string}) => void }) => {
    const [activeTab, setActiveTab] = useState<'signature' | 'photo'>('signature');
    const [signatureData, setSignatureData] = useState<string | undefined>(undefined);
    const [photoData, setPhotoData] = useState<string | undefined>(undefined);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
    }, [activeTab]);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        isDrawing.current = true;
        const { offsetX, offsetY } = getCoords(e);
        const ctx = canvasRef.current?.getContext('2d');
        ctx?.beginPath();
        ctx?.moveTo(offsetX, offsetY);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing.current) return;
        const { offsetX, offsetY } = getCoords(e);
        const ctx = canvasRef.current?.getContext('2d');
        ctx?.lineTo(offsetX, offsetY);
        ctx?.stroke();
    };

    const stopDrawing = () => {
        isDrawing.current = false;
        const canvas = canvasRef.current;
        if (canvas) {
            setSignatureData(canvas.toDataURL('image/png'));
        }
    };
    
    const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { offsetX: 0, offsetY: 0 };
        const rect = canvas.getBoundingClientRect();
        if ('touches' in e.nativeEvent) {
            return {
                offsetX: e.nativeEvent.touches[0].clientX - rect.left,
                offsetY: e.nativeEvent.touches[0].clientY - rect.top
            };
        }
        return { offsetX: e.nativeEvent.offsetX, offsetY: e.nativeEvent.offsetY };
    }

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureData(undefined);
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoData(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleSubmit = () => {
        onConfirm({ signature: signatureData, proofPhoto: photoData });
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b">
                    <h3 className="text-xl font-bold">הוכחת מסירה להזמנה #{order.id}</h3>
                    <p className="text-sm text-gray-600">נא לבחור אחת מהאפשרויות הבאות:</p>
                </div>
                <div className="p-6">
                    <div className="flex border-b mb-4">
                        <button onClick={() => setActiveTab('signature')} className={`flex-1 py-2 text-center font-semibold ${activeTab === 'signature' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>חתימת לקוח</button>
                        <button onClick={() => setActiveTab('photo')} className={`flex-1 py-2 text-center font-semibold ${activeTab === 'photo' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>צילום תמונה</button>
                    </div>
                    {activeTab === 'signature' && (
                        <div>
                            <p className="mb-2">נא לחתום במסגרת:</p>
                            <canvas
                                ref={canvasRef}
                                width="400"
                                height="200"
                                className="border border-gray-400 rounded-md w-full"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                            ></canvas>
                             <button onClick={clearCanvas} className="text-sm text-blue-600 hover:underline mt-2">נקה חתימה</button>
                        </div>
                    )}
                    {activeTab === 'photo' && (
                        <div>
                            <p className="mb-2">נא להעלות תמונה כהוכחת מסירה:</p>
                            <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                            {photoData && <img src={photoData} alt="Proof" className="mt-4 max-h-48 rounded-md" />}
                        </div>
                    )}
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-3 rounded-b-lg">
                    <button onClick={onClose} className="py-2 px-4 bg-gray-200 rounded-lg font-semibold">ביטול</button>
                    <button onClick={handleSubmit} disabled={!signatureData && !photoData} className="py-2 px-4 bg-green-500 text-white rounded-lg font-semibold disabled:bg-gray-400">אישור מסירה</button>
                </div>
            </div>
        </div>
    );
};

const LoginScreen = ({ onLogin }: { onLogin: (username: string, password: string) => void }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLogin(username, password);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 space-y-8">
                 <div>
                    <h2 className="text-center text-3xl font-extrabold text-gray-900">
                       ברוכים הבאים
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        התחבר לחשבונך
                    </p>
                </div>
                <form className="space-y-6" onSubmit={handleSubmit}>
                     <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <input id="username" name="username" type="text" value={username} onChange={e => setUsername(e.target.value)} required className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 focus:z-10 sm:text-sm" placeholder="שם משתמש" />
                        </div>
                        <div>
                            <input id="password" name="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-yellow-500 focus:border-yellow-500 focus:z-10 sm:text-sm" placeholder="סיסמה" />
                        </div>
                    </div>
                    <div>
                        <button type="submit" className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-500 hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500">
                            התחבר
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const App = () => {
    const [currentUser, setCurrentUser] = useState<User | null>(getInitialUser);
    const [orders, setOrders] = useState<Order[]>(() => getInitialData(STORAGE_KEY_ORDERS, mockOrders));
    const [users, setUsers] = useState<User[]>(() => getInitialData(STORAGE_KEY_USERS_LIST, initialUsers));

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(orders));
    }, [orders]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_USERS_LIST, JSON.stringify(users));
    }, [users]);


    const handleLogin = (username: string, password: string) => {
        const user = users.find(u => u.username === username && u.password === password);
        if (user) {
            setCurrentUser(user);
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
        } else {
            alert('שם משתמש או סיסמה שגויים');
        }
    };

    const handleLogout = () => {
        setCurrentUser(null);
        localStorage.removeItem(STORAGE_KEY_USER);
    };

    const addOrder = (newOrderData: Omit<Order, 'id' | 'status'>) => {
        const newOrder: Order = {
            id: Math.max(...orders.map(o => o.id), 0) + 1,
            status: 'new',
            ...newOrderData
        };
        setOrders(prevOrders => [...prevOrders, newOrder]);
    };
    
    const addUser = (newUserData: Omit<User, 'id'>) => {
        const newUser: User = {
            id: Math.max(...users.map(u => u.id), 0) + 1,
            ...newUserData
        };
        setUsers(prevUsers => [...prevUsers, newUser]);
    };

    const updateOrder = (updatedOrder: Order) => {
        setOrders(prevOrders => prevOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    };

    if (!currentUser) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    const renderPortal = () => {
        switch (currentUser.role) {
            case 'customer':
                return <CustomerPortal addOrder={addOrder} />;
            case 'manager':
                return <ManagerPortal orders={orders} users={users} updateOrder={updateOrder} addUser={addUser} />;
            case 'courier':
                return <CourierPortal user={currentUser} orders={orders} updateOrder={updateOrder} />;
            default:
                return <p>Error: Unknown user role.</p>;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Header user={currentUser} onLogout={handleLogout} />
            <main>
                {renderPortal()}
            </main>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<React.StrictMode><App /></React.StrictMode>);